// Rakuten Advertising sync — pulls products from the Product Search API and
// upserts them into the unified `products` table (network = 'rakuten'). Runs
// alongside Awin/CJ on the nightly cron.

import { createServiceClient } from "@/utils/supabase/admin";
import { fetchRakutenProducts, type RakutenRawProduct } from "./rakuten";
import { normalizeRakuten } from "./normalize";
import { upsertProducts } from "./upsert-products";
import type { NormalizedProduct } from "./types";

const MAX_RAKUTEN = 2000;

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

  // Gift cards arrive as many rows per brand (denominations $25/$50/$100 and
  // physical vs eGift). Normalize first (clean titles), then collapse to ONE card
  // per brand on a format-stripped key — preferring the eGift (instant, giftable),
  // otherwise the cheapest.
  const brandKey = (t: string) =>
    t.toLowerCase().replace(/\b(physical|e-?gift|egift|gift|card)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const best = new Map<string, NormalizedProduct>();
  for (const r of raw) {
    const p = normalizeRakuten(r);
    if (!p) continue;
    const key = `${p.merchant_name}|${brandKey(p.title)}`;
    const cur = best.get(key);
    if (!cur) { best.set(key, p); continue; }
    const pEgift = /e-?gift/i.test(p.title), curEgift = /e-?gift/i.test(cur.title);
    if (pEgift && !curEgift) best.set(key, p);
    else if (pEgift === curEgift && (p.price ?? Infinity) < (cur.price ?? Infinity)) best.set(key, p);
  }

  const byId = new Map<string, NormalizedProduct>();
  for (const p of best.values()) byId.set(`${p.network}:${p.network_product_id}`, p);
  const products = [...byId.values()];

  const byMerchant: Record<string, number> = {};
  for (const p of products) byMerchant[p.merchant_name || "?"] = (byMerchant[p.merchant_name || "?"] || 0) + 1;

  const imported = await upsertProducts(admin, products, "rakuten", ranAt);

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
