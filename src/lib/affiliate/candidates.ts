// Loads affiliate products that plausibly fit the quiz answers, mapped into the
// recommender's `Gift` shape so `getRecommendations` can score them alongside
// the curated catalogue (a free blend — best matches win, any source).
//
// Pre-filtered in SQL (gender, budget, and relevance via the tag/recipient/
// occasion GIN indexes) so we never load all ~11K products into memory. Fails
// soft: returns [] on any error, so the quiz still works from `gifts` alone.

import { createServiceClient } from "@/utils/supabase/admin";
import type { Gift, QuizAnswers } from "@/lib/recommend";
import { isBlockedTitle } from "./blocklist";

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
  merchant_name: string | null;
  style: string[] | null; gift_type: string[] | null; avoid_flags: string[] | null; primary_interest: string | null;
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
    style: p.style || [],
    gift_type: p.gift_type || [],
    avoid_flags: p.avoid_flags || [],
    primary_interest: p.primary_interest || null,
  };
  (g as any).__source = "product";
  (g as any).__productId = p.id;
  return g;
}

export async function loadProductCandidates(answers: QuizAnswers): Promise<Gift[]> {
  try {
    const admin = createServiceClient();
    const cols = "id, title, description, image_url, price, tags, occasions, recipients, gender, affiliate_link, network, merchant_name, style, gift_type, avoid_flags, primary_interest";
    const wantGender = (answers.gender || "").toLowerCase();
    const genders = wantGender === "male" || wantGender === "female" ? ["unisex", wantGender] : null;
    const band = BUDGET_BANDS[answers.budget];

    // Quiz gate (Step 3c): only APPROVED, in-stock products are eligible. This
    // retires Step 1's temporary trusted-merchant filter — approval status now
    // reflects trust + blocklist (set at ingestion / admin review).
    const base = () => {
      let q = admin
        .from("products")
        .select(cols)
        .eq("active", true)
        .eq("in_stock", true)
        .eq("status", "approved")
        .not("image_url", "is", null);
      if (genders) q = q.in("gender", genders);
      // Budget is a ceiling, not a band (Step 4b) — don't hide cheaper relevant items.
      if (band) q = q.lte("price", band[1]);
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
    // Brand-safety: drop titles matching the keyword blocklist (political,
    // offensive, medical-claim, trademarked). Applied here (not in SQL) because
    // the candidate set is already small and the match is whole-word in JS.
    return Array.from(map.values()).filter((p) => !isBlockedTitle(p.title, p.merchant_name)).map(toGift);
  } catch (e) {
    console.error("[candidates] loadProductCandidates failed (gifts-only):", (e as any)?.message || e);
    return [];
  }
}
