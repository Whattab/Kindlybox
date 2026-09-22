// Normalization + tagging: the layer your notes called out as the important one.
// Maps a raw Awin row onto KindlyBox's unified shape AND onto the internal tag /
// occasion / recipient vocabulary the quiz scorer understands — so the quiz
// never has to know a product came from Awin.

import type { AwinRow } from "./awin";
import type { CjRawProduct } from "./cj";
import type { RakutenRawProduct } from "./rakuten";
import type { NormalizedProduct } from "./types";

// Keyword → internal TAG. First match(es) win; a product can carry several tags.
const TAG_KEYWORDS: Record<string, string[]> = {
  "tech & gadgets": ["tech", "gadget", "electronic", "usb", "bluetooth", "charger", "headphone", "earbud", "speaker", "camera", "smart ", "drone", "projector"],
  "fashion & accessories": ["watch", "jewelry", "jewellery", "necklace", "bracelet", "ring", "earring", "scarf", "handbag", "wallet", "sunglasses", "belt", "fashion", "apparel", "clothing", "dress", "shirt", "gemstone", "pendant"],
  "books & reading": ["book", "journal", "notebook", "novel", "diary"],
  "home & kitchen": ["kitchen", "mug", "cup", "cookware", "utensil", "dinnerware", "coffee", "tea ", "tumbler", "bottle", "bakeware", "cutting board"],
  "fitness & wellness": ["wellness", "spa", "massage", "yoga", "fitness", "workout", "weighted blanket", "bath", "body", "candle", "aromatherapy", "essential oil", "self-care", "relax", "soap", "skincare"],
  "outdoor/ adventure": ["outdoor", "camping", "hiking", "adventure", "tent", "backpack"],
  "art & crafts": ["craft", "painting", "diy", "bead", "knit", "pottery", "drawing", "poster", "canvas", "print", "wall art"],
  "music & instruments": ["guitar", "instrument", "vinyl", "record player", "piano", "ukulele"],
  gaming: ["gaming", "game", "console", "controller", "puzzle", "board game"],
  gardening: ["garden", "planter", "succulent", "seeds", "plant "],
  "movies & tv": ["movie", "film", "cinema"],
  travel: ["travel", "luggage", "suitcase", "passport", "duffel"],
  pets: ["pet", " dog", " cat", "puppy", "kitten", "collar", "leash", "paw"],
  "home decor": ["decor", "rug", "lamp", "lighting", "vase", "cushion", "pillow", "throw", "frame", "ornament", "curtain", "mirror", "wall art", "flower", "bouquet"],
};

const OCCASION_KEYWORDS: Record<string, string[]> = {
  birthday: ["birthday"],
  anniversary: ["anniversary"],
  graduation: ["graduation", "graduate"],
  "baby shower": ["baby", "newborn", "nursery"],
  wedding: ["wedding", "bridal", "bride", "groom"],
  "valentine's day": ["valentine", "romantic", " love ", "heart"],
  "promotion/retirement": ["retirement", "promotion"],
  "house warming": ["housewarming", "new home"],
  "mother's day": ["mother's day", "mothers day", " mom", "mother"],
  "father's day": ["father's day", "fathers day", " dad", "father"],
};

const RECIPIENT_KEYWORDS: Record<string, string[]> = {
  him: ["men", "man", "him", "his", "husband", "boyfriend", "male", "guy", "mens", "father", "dad"],
  her: ["women", "woman", "her", "wife", "girlfriend", "female", "ladies", "womens", "mother", "mom"],
  parent: ["parent", "mother", "father", "mom", "dad", "parents"],
  child: ["kid", "kids", "child", "children", "toddler", "boy", "girl", "baby"],
  sibling: ["brother", "sister", "sibling"],
  "co-worker": ["coworker", "colleague", "office"],
  "teacher/mentor": ["teacher", "mentor", "professor"],
  friend: ["friend", "friends", "bestie"],
};

const FEMALE = ["women", "woman", "womens", "her", "wife", "girlfriend", "ladies", "female", "girl", "mother", "mom"];
const MALE = ["men", "man", "mens", "him", "his", "husband", "boyfriend", "male", "boy", "father", "dad", "guy"];

// Per-merchant tag policy. We carry only a handful of merchants, and keyword
// tagging on their product TITLES is noisy — a florist's "Best Pet Parent"
// bouquet is not a pet product, a "Smart Bird Feeder" is not tech. So each known
// merchant declares:
//   base  — tags applied to EVERY one of its products (also fixes keyword-less
//           items, e.g. a jewellery SKU whose title never says "jewelry")
//   allow — if set, keyword-derived tags survive ONLY when in this set; anything
//           else the title's keywords suggest is dropped.
// Merchants with no profile keep the raw keyword tags (they're genuinely mixed).
interface MerchantProfile {
  base?: string[];
  allow?: string[];
}
const MERCHANT_PROFILES: Record<string, MerchantProfile> = {
  // Personalised-gift catalogue — genuinely mixed, so no forced base; just fence
  // the keyword tags to the categories it actually sells.
  "Lucasgift - US": { allow: ["fashion & accessories", "home decor", "pets", "art & crafts"] },
  // Print-on-demand apparel: every item is fashion, but a themed shirt keeps its
  // theme (a gaming tee → gaming) so it can still match that interest. Physical-
  // object categories a shirt can't be (home decor, kitchen, tech, travel) are
  // excluded by omission from `allow`.
  Printerval: {
    base: ["fashion & accessories"],
    allow: ["fashion & accessories", "gaming", "pets", "fitness & wellness", "music & instruments", "movies & tv", "art & crafts", "outdoor/ adventure", "gardening", "books & reading"],
  },
  "Flowers Fast.com-Send Flowers Same Day Delivery": { base: ["home decor"], allow: ["home decor", "gardening"] },
  BBBGEM: { base: ["fashion & accessories"], allow: ["fashion & accessories"] },
  "Watches Of USA": { base: ["fashion & accessories"], allow: ["fashion & accessories"] },
  "LOOMY Home": { base: ["home decor"], allow: ["home decor", "art & crafts"] },
  PawFurEver: { base: ["pets"], allow: ["pets"] },
  "Mosaic Weighted Blankets": { base: ["fitness & wellness", "home decor"], allow: ["fitness & wellness", "home decor"] },
  GraphicAudio: { base: ["books & reading"], allow: ["books & reading"] }, // audio dramas / narrated books
  "Bond Touch": { base: ["tech & gadgets", "fashion & accessories"], allow: ["tech & gadgets", "fashion & accessories"] },
  // Gift cards are their own thing — never tag them as fashion/home/etc. or they'd
  // pollute interest matching. base "gift cards" keeps them grouped and out of the
  // quiz (which has no "gift cards" interest), while staying available to articles.
  "Giftcards.com": { base: ["gift cards"], allow: ["gift cards"] },
};

function applyMerchantProfile(keywordTags: string[], merchant?: string | null): string[] {
  const prof = merchant ? MERCHANT_PROFILES[merchant] : undefined;
  if (!prof) return keywordTags;
  const kept = prof.allow ? keywordTags.filter((t) => prof.allow!.includes(t)) : keywordTags;
  return Array.from(new Set([...(prof.base ?? []), ...kept]));
}

// Word-boundary aware matcher. Single words match as whole words (so "men"
// never matches inside "women"); multi-word phrases match as substrings.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compile(kws: string[]): RegExp[] {
  return kws.map((k) => (k.includes(" ") ? new RegExp(escape(k), "i") : new RegExp(`\\b${escape(k)}\\b`, "i")));
}
function compileMap(map: Record<string, string[]>): [string, RegExp[]][] {
  return Object.entries(map).map(([label, kws]) => [label, compile(kws)]);
}
const TAG_RX = compileMap(TAG_KEYWORDS);
const OCCASION_RX = compileMap(OCCASION_KEYWORDS);
const RECIPIENT_RX = compileMap(RECIPIENT_KEYWORDS);
const FEMALE_RX = compile(FEMALE);
const MALE_RX = compile(MALE);

function matchKeywords(haystack: string, compiled: [string, RegExp[]][]): string[] {
  const out: string[] = [];
  for (const [label, res] of compiled) {
    if (res.some((r) => r.test(haystack))) out.push(label);
  }
  return out;
}

// Shared attribute inference from a product's text — used by EVERY network's
// normalizer, so a CJ product is tagged exactly like an Awin one.
export function deriveAttributes(hay: string, merchant?: string | null) {
  const isF = FEMALE_RX.some((r) => r.test(hay));
  const isM = MALE_RX.some((r) => r.test(hay));
  // If both (or neither) show up, it's not clearly gendered → unisex.
  const gender = isF && !isM ? "female" : isM && !isF ? "male" : "unisex";
  return {
    tags: applyMerchantProfile(matchKeywords(hay, TAG_RX), merchant),
    occasions: matchKeywords(hay, OCCASION_RX),
    recipients: matchKeywords(hay, RECIPIENT_RX),
    gender,
  };
}

function parsePrice(row: AwinRow): number | null {
  const raw = row.search_price || row.store_price || "";
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeAwin(row: AwinRow, feedId: string): NormalizedProduct | null {
  const title = (row.product_name || "").trim();
  const affiliate_link = (row.aw_deep_link || "").trim();
  const image_url = (row.aw_image_url || row.merchant_image_url || "").trim() || null;
  const price = parsePrice(row);

  // Gift-viable gate: needs a name, a tracked link, an image, and a real price.
  if (!title || !affiliate_link || !image_url || price === null) return null;

  const category = (row.category_name || row.merchant_category || "").trim() || null;
  const description = (row.description || row.product_short_description || "").trim() || null;
  const hay = ` ${[title, category, description, row.brand_name].filter(Boolean).join(" ").toLowerCase()} `;

  const { tags, occasions, recipients, gender } = deriveAttributes(hay, row.merchant_name);

  return {
    network: "awin",
    network_product_id: row.aw_product_id || row.merchant_product_id || affiliate_link,
    merchant_id: row.merchant_id || null,
    merchant_name: row.merchant_name || null,
    feed_id: feedId,
    title,
    description: description ? description.slice(0, 1000) : null,
    image_url,
    price,
    currency: row.currency || "USD",
    category,
    tags,
    occasions,
    recipients,
    gender,
    affiliate_link,
    in_stock: !/^(0|no|false|out)/i.test(row.in_stock || "1"),
    raw: {},
  };
}

// CJ Affiliate product → unified shape. Same tagging, gender, and gift-viability
// gate as Awin; the tracked click URL is the affiliate link.
export function normalizeCj(p: CjRawProduct): NormalizedProduct | null {
  const title = p.title;
  const affiliate_link = p.clickUrl;
  const image_url = p.imageLink;
  const price = p.price != null && p.price > 0 ? p.price : null;

  if (!title || !affiliate_link || !image_url || price === null) return null;

  const hay = ` ${[title, p.description, p.brand, p.advertiserName].filter(Boolean).join(" ").toLowerCase()} `;
  const { tags, occasions, recipients, gender } = deriveAttributes(hay, p.advertiserName);

  return {
    network: "cj",
    network_product_id: p.id || affiliate_link,
    merchant_id: p.advertiserId,
    merchant_name: p.advertiserName,
    feed_id: null,
    title,
    description: p.description ? p.description.slice(0, 1000) : null,
    image_url,
    price,
    currency: p.currency || "USD",
    category: null,
    tags,
    occasions,
    recipients,
    gender,
    affiliate_link,
    in_stock: true,
    raw: {},
  };
}

// Rakuten Advertising product → unified shape. Same tagging + gift-viability gate;
// the tracked LinkSynergy click URL is the affiliate link.
export function normalizeRakuten(p: RakutenRawProduct): NormalizedProduct | null {
  const title = (p.productName || "").trim();
  const affiliate_link = (p.linkUrl || "").trim();
  const image_url = (p.imageUrl || "").trim() || null;
  const price = p.price;

  if (!title || !affiliate_link || !image_url || price === null) return null;

  const hay = ` ${[title, p.category, p.description, p.merchantName].filter(Boolean).join(" ").toLowerCase()} `;
  const { tags, occasions, recipients, gender } = deriveAttributes(hay, p.merchantName);

  return {
    network: "rakuten",
    network_product_id: p.sku || affiliate_link,
    merchant_id: p.mid,
    merchant_name: p.merchantName,
    feed_id: null,
    title,
    description: p.description ? p.description.slice(0, 1000) : null,
    image_url,
    price,
    currency: "USD",
    category: p.category,
    tags,
    occasions,
    recipients,
    gender,
    affiliate_link,
    in_stock: true,
    raw: {},
  };
}
