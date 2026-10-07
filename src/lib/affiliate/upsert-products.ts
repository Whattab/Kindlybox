// Stage-aware, tag-safe product upsert (Step 3c). Shared by all three network
// syncs. Two things it guarantees vs. a plain full-row upsert:
//   1. NEW rows get a review `status` (approved / staged / rejected).
//   2. EXISTING rows are updated with VOLATILE fields only (price/stock/image/
//      link), so human-/sync-set tags and an approved status are never clobbered.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedProduct } from "./types";
import { isHardBlocked, isReviewFlagged, isTrademarkBlocked } from "./blocklist";
import { isTrustedMerchant } from "./trusted-merchants";

const UPSERT_BATCH = 500;

export type ProductStatus = "staged" | "approved" | "rejected";

// Interim status rule (until Step 4's AI tag confidence):
//   hard-blocked OR trademark on an untrusted merchant → rejected
//   review-flagged (mild profanity / partisan / rec-drugs) → staged
//   trusted merchant → approved
//   otherwise (new/untrusted merchant, clean) → staged
export function computeStatus(p: NormalizedProduct): ProductStatus {
  const trusted = isTrustedMerchant(p.merchant_name);
  if (isHardBlocked(p.title) || (isTrademarkBlocked(p.title) && !trusted)) return "rejected";
  if (isReviewFlagged(p.title)) return "staged";
  if (trusted) return "approved";
  return "staged";
}

async function existingIds(admin: SupabaseClient, network: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("products")
      .select("network_product_id")
      .eq("network", network)
      .range(from, from + 999);
    if (error) throw new Error(`existingIds failed: ${error.message}`);
    const rows = data || [];
    for (const r of rows as { network_product_id: string }[]) ids.add(r.network_product_id);
    if (rows.length < 1000) break;
  }
  return ids;
}

export async function upsertProducts(
  admin: SupabaseClient,
  products: NormalizedProduct[],
  network: string,
  ranAt: string,
): Promise<number> {
  const existing = await existingIds(admin, network);
  const isNew = (p: NormalizedProduct) => !existing.has(p.network_product_id);
  const newRows = products.filter(isNew);
  const updRows = products.filter((p) => !isNew(p));

  // NEW → full row + computed status.
  for (let i = 0; i < newRows.length; i += UPSERT_BATCH) {
    const batch = newRows.slice(i, i + UPSERT_BATCH).map((p) => ({
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
      status: computeStatus(p),
      active: true,
      last_seen_at: ranAt,
      updated_at: ranAt,
    }));
    const { error } = await admin.from("products").upsert(batch, { onConflict: "network,network_product_id" });
    if (error) throw new Error(`insert-new upsert failed: ${error.message}`);
  }

  // EXISTING → volatile fields only. Omitting tags/occasions/recipients/style/
  // status/category/merchant means ON CONFLICT DO UPDATE leaves those untouched.
  for (let i = 0; i < updRows.length; i += UPSERT_BATCH) {
    const batch = updRows.slice(i, i + UPSERT_BATCH).map((p) => ({
      network: p.network,
      network_product_id: p.network_product_id,
      title: p.title,
      affiliate_link: p.affiliate_link,
      price: p.price,
      currency: p.currency,
      image_url: p.image_url,
      in_stock: p.in_stock,
      active: true,
      last_seen_at: ranAt,
      updated_at: ranAt,
    }));
    const { error } = await admin.from("products").upsert(batch, { onConflict: "network,network_product_id" });
    if (error) throw new Error(`update-existing upsert failed: ${error.message}`);
  }

  return newRows.length + updRows.length;
}
