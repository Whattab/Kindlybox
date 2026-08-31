// Loads affiliate products that plausibly fit the quiz answers, mapped into the
// recommender's `Gift` shape so `getRecommendations` can score them alongside
// the curated catalogue (a free blend — best matches win, any source).
//
// Pre-filtered in SQL (gender, budget, and relevance via the tag/recipient/
// occasion GIN indexes) so we never load all ~11K products into memory. Fails
// soft: returns [] on any error, so the quiz still works from `gifts` alone.

import { createServiceClient } from "@/utils/supabase/admin";
import type { Gift, QuizAnswers } from "@/lib/recommend";

const BUDGET_BANDS: Record<string, [number, number]> = {
  "under-25": [0, 25],
  "25-50": [25, 50],
  "50-100": [50, 100],
  "100-200": [100, 200],
};

interface ProductRow {
  id: string; title: string; description: string | null; image_url: string | null;
  price: number | null; tags: string[] | null; occasions: string[] | null;
  recipients: string[] | null; gender: string | null; affiliate_link: string; network: string | null;
}

// Marker fields (__source/__productId) ride along so the submit route can tell a
// blended product apart from a curated gift when saving the suggestion.
function toGift(p: ProductRow): Gift {
  const price = Number(p.price) || 0;
  const g: Gift = {
    id: p.id,
    name: p.title,
    description: p.description || "",
    image_url: p.image_url || "",
    price_min: price,
    price_max: price,
    tags: p.tags || [],
    occasions: p.occasions || [],
    recipients: p.recipients || [],
    gender: p.gender || "unisex",
    slug: null,
    destination_url: p.affiliate_link,
    affiliate_url: p.affiliate_link,
    affiliate_network: p.network || "awin",
    active: true,
  };
  (g as any).__source = "product";
  (g as any).__productId = p.id;
  return g;
}

export async function loadProductCandidates(answers: QuizAnswers): Promise<Gift[]> {
  try {
    const admin = createServiceClient();
    const cols = "id, title, description, image_url, price, tags, occasions, recipients, gender, affiliate_link, network";
    const wantGender = (answers.gender || "").toLowerCase();
    const genders = wantGender === "male" || wantGender === "female" ? ["unisex", wantGender] : null;
    const band = BUDGET_BANDS[answers.budget];

    const base = () => {
      let q = admin.from("products").select(cols).eq("active", true).not("image_url", "is", null);
      if (genders) q = q.in("gender", genders);
      if (band) q = q.gte("price", band[0]).lte("price", band[1]);
      return q;
    };

    // A few simple relevance queries (each uses one index) merged + deduped —
    // avoids one giant OR and keeps the candidate set relevant, not arbitrary.
    const interests = (answers.interests || []).filter(Boolean);
    const queries: any[] = [];
    if (interests.length) queries.push(base().overlaps("tags", interests).limit(600));
    if (answers.recipient) queries.push(base().contains("recipients", [answers.recipient]).limit(400));
    if (answers.occasion) queries.push(base().contains("occasions", [answers.occasion]).limit(400));
    if (queries.length === 0) queries.push(base().limit(400));

    const results = await Promise.all(queries);
    const map = new Map<string, ProductRow>();
    for (const r of results) for (const p of ((r.data || []) as ProductRow[])) if (!map.has(p.id)) map.set(p.id, p);
    return [...map.values()].map(toGift);
  } catch (e) {
    console.error("[candidates] loadProductCandidates failed (gifts-only):", (e as any)?.message || e);
    return [];
  }
}
