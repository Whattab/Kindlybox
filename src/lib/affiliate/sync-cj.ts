// CJ Affiliate sync — pulls joined shopping products and upserts them into the
// same unified `products` table as Awin (network = 'cj'). Runs alongside the
// Awin sync on the nightly cron.

import { createServiceClient } from "@/utils/supabase/admin";
import { fetchJoinedShoppingProducts } from "./cj";
import { normalizeCj } from "./normalize";
import { upsertProducts } from "./upsert-products";
import type { NormalizedProduct } from "./types";

const MAX_CJ = 4000;

// Merchants we don't sync, by advertiserName:
//  - BOOKSAMILLION.COM: book covers are hotlink-protected (403 from our domain),
//    so every card renders blank — excluded until they fix it or we add a book
//    merchant whose images load.
//  - Abracadabra NYC: costumes, theatrical props (incl. toy weapons) and party
//    items. Off-brand for a gift-recommendation quiz and not safe to auto-
//    recommend unvetted, so excluded at the source.
const MERCHANT_BLOCKLIST = new Set<string>(["BOOKSAMILLION.COM", "Abracadabra NYC"]);

export interface CjSyncSummary {
  ran_at: string;
  network: string;
  fetched: number;
  imported: number;
  deactivated: number;
  by_merchant: Record<string, number>;
  status: string;
}

export async function syncCj(): Promise<CjSyncSummary> {
  const admin = createServiceClient();
  const ranAt = new Date().toISOString();

  const raw = await fetchJoinedShoppingProducts(MAX_CJ);
  const byId = new Map<string, NormalizedProduct>();
  for (const r of raw) {
    if (MERCHANT_BLOCKLIST.has(r.advertiserName || "")) continue;
    const p = normalizeCj(r);
    if (p) byId.set(`${p.network}:${p.network_product_id}`, p);
  }
  const products = [...byId.values()];

  const byMerchant: Record<string, number> = {};
  for (const p of products) byMerchant[p.merchant_name || "?"] = (byMerchant[p.merchant_name || "?"] || 0) + 1;

  const imported = await upsertProducts(admin, products, "cj", ranAt);

  // CJ products no longer returned this run → mark inactive.
  let deactivated = 0;
  if (imported > 0) {
    const { data: gone } = await admin
      .from("products")
      .update({ active: false, updated_at: ranAt })
      .eq("network", "cj")
      .lt("last_seen_at", ranAt)
      .select("id");
    deactivated = gone?.length ?? 0;
  }

  const summary: CjSyncSummary = { ran_at: ranAt, network: "cj", fetched: raw.length, imported, deactivated, by_merchant: byMerchant, status: "ok" };
  await admin.from("affiliate_sync_runs").insert({
    network: "cj", imported, deactivated, status: "ok", detail: summary as any, finished_at: new Date().toISOString(),
  });
  return summary;
}
