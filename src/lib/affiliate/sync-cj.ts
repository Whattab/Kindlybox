// CJ Affiliate sync — pulls joined shopping products and upserts them into the
// same unified `products` table as Awin (network = 'cj'). Runs alongside the
// Awin sync on the nightly cron.

import { createServiceClient } from "@/utils/supabase/admin";
import { fetchJoinedShoppingProducts } from "./cj";
import { normalizeCj } from "./normalize";
import type { NormalizedProduct } from "./types";

const MAX_CJ = 4000;
const UPSERT_BATCH = 500;

// Merchants confirmed to have persistently broken/blocked images. BooksAMillion
// serves its book covers with hotlink protection (403 from our domain), so its
// products always render as blank cards — excluded until they fix it (or we add
// a book merchant whose images actually load).
const MERCHANT_BLOCKLIST = new Set<string>(["BOOKSAMILLION.COM"]);

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
    if (error) throw new Error(`CJ upsert failed: ${error.message}`);
    imported += batch.length;
  }

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
