// Amazon importer helpers (admin only). Kept separate from the shared quiz
// tagger (ai-tags.ts), which this only CALLS — it never changes how quiz
// tagging works.
//
//   loadImporterVocab — the live tag list grouped the way the quiz asks
//                       (broad interests with their sub-hobbies, all
//                       occasions, feels, gift types, avoid flags)
//   suggestListing    — "Suggest with AI": quiz tags (via tagItem) plus a
//                       gender guess and a blurb in the words shoppers type

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tagItem, type ItemTags } from "./ai-tags";

const GEMINI_MODEL = "gemini-2.5-flash";

export interface ImporterVocab {
  /** Broad interests in taxonomy order, each with its sub-hobbies. */
  interests: { label: string; children: string[] }[];
  /** sub-hobby → broad interest (so saving "coffee" also saves "home & kitchen"). */
  parentOf: Record<string, string>;
  occasions: string[];
  recipients: string[];
  styles: string[];
  giftTypes: string[];
  avoidFlags: string[];
}

export async function loadImporterVocab(db: SupabaseClient): Promise<ImporterVocab> {
  const { data } = await db.from("tags").select("label, dimension, path").eq("active", true).order("path");
  const rows = (data || []) as { label: string; dimension: string; path: string }[];
  const of = (d: string) => rows.filter((r) => r.dimension === d).map((r) => r.label);
  const interestRows = rows.filter((r) => r.dimension === "interest");
  const roots = interestRows.filter((r) => !r.path.includes("."));
  const parentOf: Record<string, string> = {};
  const interests = roots.map((root) => {
    const children = interestRows.filter((r) => r.path.startsWith(root.path + ".")).map((r) => r.label);
    for (const c of children) parentOf[c] = root.label;
    return { label: root.label, children };
  });
  return {
    interests, parentOf,
    occasions: of("occasion"), recipients: of("recipient"),
    styles: of("style"), giftTypes: of("gift_type"), avoidFlags: of("avoid_flag"),
  };
}

/** Keep only values in `allowed`, deduped. Pure. */
export function onlyAllowed(values: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((v): v is string => typeof v === "string" && allowed.includes(v))));
}

/** Add each sub-hobby's broad interest so both quiz paths find the gift. Pure. */
export function withParents(interests: string[], parentOf: Record<string, string>): string[] {
  const out = [...interests];
  for (const i of interests) if (parentOf[i] && !out.includes(parentOf[i])) out.push(parentOf[i]);
  return out;
}

export interface ListingSuggestion { tags: ItemTags; gender: "male" | "female" | "unisex"; blurb: string }

async function aiBlurb(text: string): Promise<{ blurb: string; gender: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { blurb: "", gender: "unisex" };
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: GEMINI_MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thinkingConfig isn't in the SDK's types yet
    generationConfig: { temperature: 0.4, maxOutputTokens: 220, thinkingConfig: { thinkingBudget: 0 } } as any,
  });
  const prompt = [
    "Write a gift-catalogue blurb for this product: ONE or TWO plain sentences (max 35 words) saying what it is and who would love it.",
    "Use the everyday words a shopper would type to describe the recipient (e.g. 'coffee lover', 'espresso', 'home cook', 'loves hiking').",
    "No prices, no ratings, no claims you can't know, no emojis, no exclamation marks.",
    "Also say whether it is clearly for men, clearly for women, or for anyone.",
    "",
    `PRODUCT: "${text}"`,
    "",
    'Return ONLY JSON: {"blurb":"...","gender":"male|female|unisex"}. No prose, no code fences.',
  ].join("\n");
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const p = JSON.parse(raw);
  return { blurb: String(p.blurb || "").trim().slice(0, 400), gender: String(p.gender || "unisex") };
}

// Obvious avoid flags the AI sometimes misses (a scented candle came back
// without "scent-sensitive"). Word rules on the product name. Pure.
const AVOID_WORDS: Record<string, string[]> = {
  "scent-sensitive": ["candle", "candles", "perfume", "cologne", "fragrance", "scented", "diffuser", "incense", "potpourri", "essential oil", "essential oils"],
  "no alcohol": ["wine", "whiskey", "whisky", "bourbon", "vodka", "tequila", "beer", "champagne", "prosecco", "cocktail", "liquor", "gin", "rum"],
};
export function avoidFlagsFromName(name: string): string[] {
  const hay = ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return Object.entries(AVOID_WORDS).filter(([, words]) => words.some((w) => hay.includes(` ${w} `))).map(([flag]) => flag);
}

/** "Suggest with AI". Fail-soft: whatever can't be suggested comes back empty. */
export async function suggestListing(title: string, notes: string | null | undefined, db: SupabaseClient): Promise<ListingSuggestion> {
  const text = [title, notes].filter(Boolean).join(". ").trim();
  const [tags, extra] = await Promise.all([
    tagItem(title, notes, db),
    aiBlurb(text).catch((e) => {
      console.error("[amazon-assist] Gemini blurb failed:", e instanceof Error ? e.message : e);
      return { blurb: "", gender: "unisex" };
    }),
  ]);
  const gender = extra.gender === "male" || extra.gender === "female" ? extra.gender : "unisex";
  const avoid_flags = Array.from(new Set([...tags.avoid_flags, ...avoidFlagsFromName(title)]));
  return { tags: { ...tags, avoid_flags }, gender, blurb: extra.blurb };
}

// ── "Where the quiz needs gifts" + "Needs attention" (Part B) ─────────────

export interface CatalogueGaps {
  /** The quiz's "Tell us a little more" options with fewer than 10 gifts (hidden in the quiz). */
  subHobbies: { label: string; parent: string; count: number }[];
  /** Occasions, thinnest first. */
  occasions: { label: string; count: number }[];
  /** Gifts that need no shipping (digital / experience) — "Last-minute ideas". */
  noShip: number;
  /** Gifts tagged for a child. */
  child: number;
}

export async function loadGaps(db: SupabaseClient, vocab: ImporterVocab, depthIds: string[], minDepth: number): Promise<CatalogueGaps> {
  const products = () => db.from("products").select("id", { count: "exact", head: true }).eq("active", true).eq("in_stock", true).eq("status", "approved");
  const gifts = () => db.from("gifts").select("id", { count: "exact", head: true }).eq("active", true);
  const both = async (col: "tags" | "occasions" | "recipients", v: string) => {
    const [p, g] = await Promise.all([products().contains(col, [v]), gifts().contains(col, [v])]);
    return (p.count || 0) + (g.count || 0);
  };
  const [hobbyCounts, occasionCounts, child, giftNoShip, productNoShip] = await Promise.all([
    Promise.all(depthIds.map(async (id) => ({ label: id, parent: vocab.parentOf[id] || "", count: await both("tags", id) }))),
    Promise.all(vocab.occasions.map(async (o) => ({ label: o, count: await both("occasions", o) }))),
    both("recipients", "child"),
    gifts().overlaps("gift_type", ["digital", "experience"]),
    products().or("title.ilike.%gift card%,title.ilike.%egift%,title.ilike.%subscription%"),
  ]);
  return {
    subHobbies: hobbyCounts.filter((h) => h.count < minDepth).sort((a, b) => a.count - b.count),
    occasions: occasionCounts.sort((a, b) => a.count - b.count),
    noShip: (giftNoShip.count || 0) + (productNoShip.count || 0),
    child,
  };
}

export interface AttentionItem { id: string; name: string; asin: string | null; problems: string[] }

const PLACEHOLDER_IMAGE = /example\.com|unsplash\.com|placeholder/i;

/** Amazon gifts with a placeholder/missing image or without the new quiz tags. */
export async function loadNeedsAttention(db: SupabaseClient): Promise<AttentionItem[]> {
  const { data } = await db.from("gifts").select("id, name, slug, image_url, style, gift_type").eq("active", true).eq("affiliate_network", "amazon").order("name");
  return (data || []).flatMap((g) => {
    const problems: string[] = [];
    if (!g.image_url || !/^https:\/\//i.test(g.image_url) || PLACEHOLDER_IMAGE.test(g.image_url)) problems.push("placeholder image");
    if (!(g.style || []).length || !(g.gift_type || []).length) problems.push("missing quiz tags");
    const asin = /^amzn-([a-z0-9]{10})$/i.exec(g.slug || "")?.[1]?.toUpperCase() ?? null;
    return problems.length ? [{ id: g.id, name: g.name, asin, problems }] : [];
  });
}

/**
 * Conservative AI backfill for an existing gift: FILL what's empty (feel, type,
 * occasions, primary interest), ADD avoid flags, and add sub-hobbies only under
 * broad interests the gift already has — never remove a choice and never add a
 * new interest area (additive tagging is how "magnet" tags crept in before).
 */
export function mergeBackfill(
  current: { tags: string[]; style: string[]; gift_type: string[]; avoid_flags: string[]; occasions: string[]; primary_interest: string | null },
  ai: ItemTags,
  parentOf: Record<string, string>,
  nameAvoid: string[],
) {
  const tags = [...current.tags];
  for (const i of ai.interests) if (parentOf[i] && current.tags.includes(parentOf[i]) && !tags.includes(i)) tags.push(i);
  return {
    tags,
    style: current.style.length ? current.style : ai.style,
    gift_type: current.gift_type.length ? current.gift_type : ai.gift_type,
    avoid_flags: Array.from(new Set([...current.avoid_flags, ...ai.avoid_flags, ...nameAvoid])),
    occasions: current.occasions.length ? current.occasions : ai.occasions,
    primary_interest: current.primary_interest || tags.find((t) => parentOf[t]) || tags[0] || null,
  };
}
