"use server";

import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { parseAsin, amazonProductUrl } from "@/lib/affiliate/tracking";
import { canonicalGender } from "@/lib/gift-vocab";
import { avoidFlagsFromName, loadImporterVocab, mergeBackfill, onlyAllowed, suggestListing, withParents, type ListingSuggestion } from "@/lib/amazon-assist";
import { tagItem } from "@/lib/ai-tags";
import { resolveAmazonShortLink } from "@/lib/affiliate/amazon-shortlink";
import { revalidatePath } from "next/cache";

export interface AddAmazonGiftInput {
  asin: string;        // bare ASIN or a full Amazon product URL
  name: string;
  blurb: string;
  imageUrl: string;    // SiteStripe image link (preferred) or "Copy image address" URL
  tags: string[];      // interests, incl. sub-hobbies (must be ≥1)
  recipients: string[];
  occasions: string[];
  style: string[];     // gift feel (practical / sentimental / luxe / fun & quirky / experience)
  giftType: string[];  // physical / consumable / experience / personalized / digital
  avoidFlags: string[];
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
// Amazon prices are never displayed (see amazon-display.ts). Every value is
// validated against the LIVE tag list, the same vocabulary the quiz uses.
export async function addAmazonGift(input: AddAmazonGiftInput): Promise<AddAmazonGiftResult> {
  await assertAdmin();

  const asin = parseAsin(input.asin);
  if (!asin) return { error: "Enter a valid ASIN (e.g. B07CSKGLMM), an Amazon product URL, or a SiteStripe image snippet." };

  const name = String(input.name || "").trim();
  if (!name) return { error: "Name is required." };

  const imageUrl = String(input.imageUrl || "").trim();
  if (!/^https:\/\//i.test(imageUrl)) return { error: "Image URL is required (paste the SiteStripe image snippet, or SiteStripe → Copy image address)." };

  const admin = createServiceClient();
  const vocab = await loadImporterVocab(admin);
  const allInterests = vocab.interests.flatMap((i) => [i.label, ...i.children]);

  // Sub-hobbies also save their broad interest, so both quiz paths find it.
  const tags = withParents(onlyAllowed(input.tags, allInterests), vocab.parentOf);
  if (tags.length === 0) return { error: "Pick at least one interest." };

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
    occasions: onlyAllowed(input.occasions, vocab.occasions),
    recipients: onlyAllowed(input.recipients, vocab.recipients),
    style: onlyAllowed(input.style, vocab.styles),
    gift_type: onlyAllowed(input.giftType, vocab.giftTypes),
    avoid_flags: onlyAllowed(input.avoidFlags, vocab.avoidFlags),
    primary_interest: tags.find((t) => vocab.parentOf[t]) || tags[0],
    gender: canonicalGender(input.gender || "unisex").value || "unisex",
    affiliate_url: link,
    destination_url: link,
    affiliate_network: "amazon",
    slug,
    active: true,
  };

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

// "Suggest with AI": pre-fills the chips + blurb for the admin to review.
export async function suggestAmazonTags(name: string, notes: string): Promise<ListingSuggestion | { error: string }> {
  await assertAdmin();
  const title = String(name || "").trim();
  if (!title) return { error: "Enter the product name first." };
  try {
    return await suggestListing(title, String(notes || "").trim(), createServiceClient());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI suggestion failed — fill the chips by hand." };
  }
}

// "Fill missing tags with AI" for the existing Amazon gifts (Part B). Uses
// the conservative merge: fills empty fields, refines existing interests with
// sub-hobbies, adds avoid flags — never removes a choice.
export async function backfillAmazonTags(): Promise<{ updated: number; checked: number; error?: string }> {
  await assertAdmin();
  const admin = createServiceClient();
  const vocab = await loadImporterVocab(admin);
  const { data } = await admin.from("gifts")
    .select("id, name, description, tags, style, gift_type, avoid_flags, occasions, primary_interest")
    .eq("active", true).eq("affiliate_network", "amazon");
  const gifts = data || [];
  let updated = 0;
  // A few at a time keeps Gemini happy and the whole run well under a minute.
  for (let i = 0; i < gifts.length; i += 4) {
    await Promise.all(gifts.slice(i, i + 4).map(async (g) => {
      try {
        const ai = await tagItem(g.name, g.description, admin);
        const merged = mergeBackfill(
          { tags: g.tags || [], style: g.style || [], gift_type: g.gift_type || [], avoid_flags: g.avoid_flags || [], occasions: g.occasions || [], primary_interest: g.primary_interest },
          ai, vocab.parentOf, avoidFlagsFromName(g.name),
        );
        const changed = JSON.stringify(merged) !== JSON.stringify({
          tags: g.tags || [], style: g.style || [], gift_type: g.gift_type || [], avoid_flags: g.avoid_flags || [],
          occasions: g.occasions || [], primary_interest: g.primary_interest,
        });
        if (changed) {
          const { error } = await admin.from("gifts").update(merged).eq("id", g.id);
          if (!error) updated++;
        }
      } catch (e) {
        console.error("[amazon-backfill]", g.name, e instanceof Error ? e.message : e);
      }
    }));
  }
  revalidatePath("/dashboard/amazon-gifts");
  return { updated, checked: gifts.length };
}

// Open an Amazon short link (link.amazon/…, amzn.to/…, a.co/…) pasted into the
// importer and return its ASIN. Errors are returned, not thrown (prod redacts).
export async function resolveAmazonLink(url: string): Promise<{ asin: string; url: string } | { error: string }> {
  await assertAdmin();
  const found = await resolveAmazonShortLink(url);
  return found ? found : { error: "Couldn't open that Amazon short link. Open it in your browser and paste the full product address (with /dp/…) or the 10-character ASIN instead." };
}
