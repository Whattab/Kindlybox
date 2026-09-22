// Rakuten Advertising sync — pulls products from the Product Search API and
// upserts them into the unified `products` table (network = 'rakuten'). Runs
// alongside Awin/CJ on the nightly cron.

import { createServiceClient } from "@/utils/supabase/admin";
import { fetchRakutenProducts, type RakutenRawProduct } from "./rakuten";
import { normalizeRakuten } from "./normalize";
import type { NormalizedProduct } from "./types";

const MAX_RAKUTEN = 2000;
const UPSERT_BATCH = 500;

export interface RakutenSyncSummary {
  ran_at: string;
  network: string;
  fetched: number;
  imported: number;
  deactivated: number;
  by_merchant: Record<string, number>;
  status: string;
}

export async function syncRakuten(): Promise<RakutenSyncSummary> {
  const admin = createServiceClient();
  const ranAt = new Date().toISOString();

  const raw = await fetchRakutenProducts(MAX_RAKUTEN);

  // Gift cards arrive as one row per denomination (same brand at $25/$50/$100…).
  // Keep a single card per brand — the lowest amount — so a brand shows once.
  const byBrand = new Map<string, RakutenRawProduct>();
  for (const r of raw) {
    const key = (r.productName || "").toLowerCase().trim();
    if (!key) continue;
    const existing = byBrand.get(key);
    if (!existing || (r.price ?? Infinity) < (existing.price ?? Infinity)) byBrand.set(key, r);
  }

  const byId = new Map<string, NormalizedProduct>();
  for (const r of byBrand.values()) {
    const p = normalizeRakuten(r);
    if (p) byId.set(`${p.network}:${p.network_product_id}`, p);
  }
  const products = [...byId.values()];

  const byMerchant: Record<string, number> = {};
  for (const p of products) byMerchant[p.merchant_name || "?"] = (byMerchant[p.merchant_name || "?"] || 0) + 1;

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
    if (error) throw new Error(`Rakuten upsert failed: ${error.message}`);
    imported += batch.length;
  }

  // Rakuten products no longer returned this run → mark inactive.
  let deactivated = 0;
  if (imported > 0) {
    const { data: gone } = await admin
      .from("products")
      .update({ active: false, updated_at: ranAt })
      .eq("network", "rakuten")
      .lt("last_seen_at", ranAt)
      .select("id");
    deactivated = gone?.length ?? 0;
  }

  const summary: RakutenSyncSummary = { ran_at: ranAt, network: "rakuten", fetched: raw.length, imported, deactivated, by_merchant: byMerchant, status: "ok" };
  await admin.from("affiliate_sync_runs").insert({
    network: "rakuten", imported, deactivated, status: "ok", detail: summary as any, finished_at: new Date().toISOString(),
  });
  return summary;
}
