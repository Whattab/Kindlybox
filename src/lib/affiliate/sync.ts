// Affiliate sync — pulls active Awin feeds, normalizes, and upserts into the
// unified `products` table. Designed to run on a schedule (nightly cron).
//
// Guards for a small database + serverless limits:
//   MAX_FEED_SIZE  — skip feeds bigger than this (defers Printerval's 542K)
//   MAX_PER_FEED   — cap products taken from any one feed

import { createServiceClient } from "@/utils/supabase/admin";
import { listFeeds, downloadFeed, downloadFeedCapped } from "./awin";
import { normalizeAwin } from "./normalize";
import type { NormalizedProduct } from "./types";

const MAX_FEED_SIZE = 60_000;
const MAX_PER_FEED = 2_500;
const UPSERT_BATCH = 500;

// Deliberate, human-reviewed exclusions — merchants confirmed to have
// PERSISTENTLY broken/missing images (not a transient blip). This is stable
// curation, unlike a live per-image check which can't tell a momentary outage
// from a real gap. Remove a name here if the merchant fixes their feed; better
// still, un-join them in Awin so they drop out entirely.
const MERCHANT_BLOCKLIST = new Set<string>([
  "Black Canyon Home & Body", // images consistently 302 to Awin's "noimage" placeholder
]);

const isActive = (s: string) => /active|^joined/i.test(s) && !/not joined/i.test(s);

// NB: we deliberately do NOT gate products on a live image check at import.
// Awin's image proxy is intermittently flaky — it serves a "noimage" placeholder
// while a merchant's source CDN is momentarily down, then the real image once it
// recovers. A point-in-time check can't tell a transient blip from a truly
// missing image, so gating here wrongly drops good products. Broken images are
// handled gracefully at RENDER time instead (GiftImage retries, then falls back).

export interface SyncSummary {
  ran_at: string;
  network: string;
  feeds_active: number;
  feeds_processed: number;
  feeds_skipped: { advertiser: string; reason: string; size: number }[];
  imported: number;
  deactivated: number;
  per_feed: { advertiser: string; feedId: string; kept: number }[];
  status: string;
  note?: string;
}

export async function syncAwin(): Promise<SyncSummary> {
  const admin = createServiceClient();
  const ranAt = new Date().toISOString();
  const feeds = (await listFeeds()).filter((f) => isActive(f.membershipStatus));

  const skipped: SyncSummary["feeds_skipped"] = [];
  const perFeed: SyncSummary["per_feed"] = [];
  const byId = new Map<string, NormalizedProduct>();

  for (const feed of feeds) {
    if (MERCHANT_BLOCKLIST.has(feed.advertiserName)) {
      skipped.push({ advertiser: feed.advertiserName, reason: "blocklisted (persistently broken images)", size: feed.noOfProducts });
      continue;
    }
    try {
      // Huge feeds (e.g. Printerval's 542K) stream in as a capped slice; normal
      // feeds download in full. We over-pull raw rows so we still clear
      // MAX_PER_FEED viable products after the gift-viability filter.
      const rows = feed.noOfProducts > MAX_FEED_SIZE
        ? await downloadFeedCapped(feed.feedId, MAX_PER_FEED * 5)
        : await downloadFeed(feed.feedId);
      let kept = 0;
      for (const row of rows) {
        if (kept >= MAX_PER_FEED) break;
        const p = normalizeAwin(row, feed.feedId);
        if (!p) continue;
        byId.set(`${p.network}:${p.network_product_id}`, p);
        kept++;
      }
      perFeed.push({ advertiser: feed.advertiserName, feedId: feed.feedId, kept });
    } catch (e: any) {
      skipped.push({ advertiser: feed.advertiserName, reason: e?.message || "download failed", size: feed.noOfProducts });
    }
  }

  // Upsert in batches.
  const products = [...byId.values()];
  let imported = 0;
  for (let i = 0; i < products.length; i += UPSERT_BATCH) {
    const batch = products.slice(i, i + UPSERT_BATCH).map((p) => ({
      network: p.network,
      network_product_id: p.network_product_id,
      merchant_id: p.merchant_id,
      merchant_name: p.merchant_name,
      feed_id: p.feed_id,
      title: p.title,
      description: p.description,
      image_url: p.image_url,
      price: p.price,
      currency: p.currency,
      category: p.category,
      tags: p.tags,
      occasions: p.occasions,
      recipients: p.recipients,
      gender: p.gender,
      affiliate_link: p.affiliate_link,
      in_stock: p.in_stock,
      active: true,
      last_seen_at: ranAt,
      updated_at: ranAt,
    }));
    const { error } = await admin.from("products").upsert(batch, { onConflict: "network,network_product_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    imported += batch.length;
  }

  // Anything from a processed network no longer in the feeds → mark inactive.
  let deactivated = 0;
  if (imported > 0) {
    const { data: gone } = await admin
      .from("products")
      .update({ active: false, updated_at: ranAt })
      .eq("network", "awin")
      .lt("last_seen_at", ranAt)
      .select("id");
    deactivated = gone?.length ?? 0;
  }

  const summary: SyncSummary = {
    ran_at: ranAt,
    network: "awin",
    feeds_active: feeds.length,
    feeds_processed: perFeed.length,
    feeds_skipped: skipped,
    imported,
    deactivated,
    per_feed: perFeed,
    status: "ok",
  };

  // Log the run (best-effort).
  await admin.from("affiliate_sync_runs").insert({
    network: "awin",
    feeds_processed: perFeed.length,
    imported,
    deactivated,
    status: "ok",
    detail: summary as any,
    finished_at: new Date().toISOString(),
  });

  return summary;
}
