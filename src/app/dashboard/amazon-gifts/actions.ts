"use server";

import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { parseAsin, amazonProductUrl } from "@/lib/affiliate/tracking";
import { canonicalTag, canonicalRecipient, canonicalOccasion, canonicalGender } from "@/lib/gift-vocab";

export interface AddAmazonGiftInput {
  asin: string;        // bare ASIN or a full Amazon product URL
  name: string;
  blurb: string;
  imageUrl: string;    // SiteStripe "Copy image address" URL
  tags: string[];      // interest tags (must be ≥1)
  recipients: string[];
  occasions: string[];
  gender: string;      // unisex | female | male
  priceMin: number;
  priceMax: number;
}

export interface AddAmazonGiftResult {
  ok?: boolean;
  id?: string;
  name?: string;
  updated?: boolean;   // true if it replaced an existing gift with the same ASIN
  error?: string;
}

// Add a single Amazon product to the curated `gifts` catalogue (which the quiz
// blends into recommendations). No PA-API, so the admin supplies name + image;
// the ASIN builds the tagged link. The price is for the budget filter only —
// Amazon prices are never displayed (see amazon-display.ts).
export async function addAmazonGift(input: AddAmazonGiftInput): Promise<AddAmazonGiftResult> {
  await assertAdmin();

  const asin = parseAsin(input.asin);
  if (!asin) return { error: "Enter a valid ASIN (e.g. B07CSKGLMM) or an Amazon product URL." };

  const name = String(input.name || "").trim();
  if (!name) return { error: "Name is required." };

  const imageUrl = String(input.imageUrl || "").trim();
  if (!imageUrl) return { error: "Image URL is required (SiteStripe → Copy image address)." };

  // Keep only valid interest tags; require at least one so the gift can match.
  const tags = Array.from(
    new Set((input.tags || []).map((t) => canonicalTag(t).value).filter((v): v is string => !!v)),
  );
  if (tags.length === 0) return { error: "Pick at least one interest tag." };

  const recipients = Array.from(
    new Set((input.recipients || []).map((r) => canonicalRecipient(r).value).filter((v): v is string => !!v)),
  );
  const occasions = Array.from(
    new Set((input.occasions || []).map((o) => canonicalOccasion(o).value).filter((v): v is string => !!v)),
  );
  const gender = canonicalGender(input.gender || "unisex").value || "unisex";

  const pMin = Number.isFinite(input.priceMin) && input.priceMin > 0 ? input.priceMin : 20;
  const pMax = Number.isFinite(input.priceMax) && input.priceMax >= pMin ? input.priceMax : Math.max(pMin, 50);

  const link = amazonProductUrl(asin);
  const slug = `amzn-${asin.toLowerCase()}`;
  const row = {
    name,
    description: String(input.blurb || "").trim() || null,
    image_url: imageUrl,
    price_min: pMin,
    price_max: pMax,
    tags,
    occasions,
    recipients,
    gender,
    affiliate_url: link,
    destination_url: link,
    affiliate_network: "amazon",
    slug,
    active: true,
  };

  const admin = createServiceClient();
  const { data: existing } = await admin.from("gifts").select("id").eq("slug", slug).maybeSingle();

  if (existing) {
    const { error } = await admin.from("gifts").update(row).eq("id", existing.id);
    if (error) return { error: error.message };
    return { ok: true, id: existing.id, name, updated: true };
  }

  const { data, error } = await admin.from("gifts").insert(row).select("id").single();
  if (error) return { error: error.message };
  return { ok: true, id: data.id, name };
}
