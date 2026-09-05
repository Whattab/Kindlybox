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
const MIN_IMAGE_HEALTH = 0.6; // skip a feed whose sampled images are mostly broken

const isActive = (s: string) => /active|^joined/i.test(s) && !/not joined/i.test(s);

// Does this URL resolve to a real image? Some merchant feeds have missing images
// and Awin's proxy 302s to a "noimage" placeholder — those must not reach a card.
async function imageOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    const ct = r.headers.get("content-type") || "";
    return r.ok && /^image\//.test(ct) && !/noimage/i.test(r.url);
  } catch {
    return false;
  }
}

// Fraction of a feed's sampled images that actually load (1 = all good).
async function sampleImageHealth(products: NormalizedProduct[], sample = 12): Promise<number> {
  const urls = products.slice(0, sample).map((p) => p.image_url).filter(Boolean) as string[];
  if (urls.length === 0) return 1;
  const results = await Promise.all(urls.map(imageOk));
  return results.filter(Boolean).length / results.length;
}

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
    try {
      // Huge feeds (e.g. Printerval's 542K) stream in as a capped slice; normal
      // feeds download in full. We over-pull raw rows so we still clear
      // MAX_PER_FEED viable products after the gift-viability filter.
      const rows = feed.noOfProducts > MAX_FEED_SIZE
        ? await downloadFeedCapped(feed.feedId, MAX_PER_FEED * 5)
        : await downloadFeed(feed.feedId);
      const feedProducts: NormalizedProduct[] = [];
      for (const row of rows) {
        if (feedProducts.length >= MAX_PER_FEED) break;
        const p = normalizeAwin(row, feed.feedId);
        if (p) feedProducts.push(p);
      }

      // Image-health gate: a gift site can't show blank cards. If a feed's images
      // are mostly missing/placeholder, skip the whole feed.
      const health = await sampleImageHealth(feedProducts);
      if (feedProducts.length > 0 && health < MIN_IMAGE_HEALTH) {
        skipped.push({ advertiser: feed.advertiserName, reason: `images mostly broken (${Math.round(health * 100)}% valid)`, size: feed.noOfProducts });
        continue;
      }

      for (const p of feedProducts) byId.set(`${p.network}:${p.network_product_id}`, p);
      perFeed.push({ advertiser: feed.advertiserName, feedId: feed.feedId, kept: feedProducts.length });
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
