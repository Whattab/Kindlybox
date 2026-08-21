export interface QuizAnswers {
  recipient: string;
  occasion: string;
  interests: string[];
  budget: string;
  ageGroup: string;
  gender: string;
  freeText?: string;
  recipientName?: string;
}

export interface Gift {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_min: number;
  price_max: number;
  tags: string[];
  occasions: string[];
  recipients: string[];
  gender?: string | null; // 'male' | 'female' | 'unisex'; missing = unisex
  slug?: string | null;
  destination_url?: string | null;
  affiliate_url: string | null;
  affiliate_network: string | null;
  active: boolean;
}

export interface GiftScore {
  gift: Gift;
  score: number;
  matchScorePercent: number;
  /** Why this gift was picked — surfaced for debugging and future UI. */
  reasons: string[];
  /** True when the gift matched the shopper's actual interests, not just
   *  demographics. False means it's a fallback, shown because nothing better
   *  exists in the catalogue yet. */
  qualified: boolean;
}

// ---- weights --------------------------------------------------------------
// Interests are what the shopper actually told us about the PERSON, so they
// now outweigh the demographic signals. Previously recipient + occasion (55)
// swamped a single interest (15), which meant an untagged interest left dozens
// of gifts tied on identical scores and the "top 3" was really "first 3 rows".
const W = {
  // The gap between these two must exceed the occasion weight, otherwise a
  // loosely-relevant gift that happens to carry the occasion tag outranks a
  // gift genuinely tagged with the interest.
  interestExact: 34,     // interest matches a gift tag outright
  interestPartial: 12,   // interest's vocabulary appears in name/description
  maxInterests: 3,
  recipient: 20,
  occasion: 18,
  freeTextToken: 6,      // max 4
  themeSignal: 8,        // max 3
  signalBonus: 6,
  priceFit: 8,           // sits comfortably inside the chosen budget band
  purchasable: 4,        // has a real destination we can send the buyer to
};

// Vocabulary for each quiz interest, so an interest can match a gift that was
// never tagged with it. "gaming" finding a Nintendo bundle matters more than
// tidy tagging, because the catalogue will always lag the quiz options.
const INTEREST_VOCAB: Record<string, string[]> = {
  "tech & gadgets": ["tech", "gadget", "electronic", "smart", "device", "wireless", "bluetooth", "digital", "camera", "headphone", "speaker", "charger", "kindle", "e-reader"],
  "fashion & accessories": ["fashion", "scarf", "jewelry", "jewellery", "necklace", "bracelet", "ring", "rings", "earring", "earrings", "pendant", "sterling silver", "gold plated", "diamond", "gemstone", "watch", "wallet", "purse", "handbag", "accessory", "style", "cashmere", "silk"],
  "books & reading": ["book", "reading", "read", "journal", "notebook", "novel", "kindle", "e-reader", "literature", "bookmark", "stationery"],
  "home & kitchen": ["home", "kitchen", "cook", "cooking", "chef", "mug", "cookware", "pasta", "dining", "coffee", "tea", "bake", "baking", "utensil", "cutting board", "apron"],
  "fitness & wellness": ["fitness", "wellness", "yoga", "gym", "workout", "exercise", "massage", "spa", "acupressure", "relax", "meditation", "sleep", "self care", "selfcare", "aromatherapy"],
  "outdoor/ adventure": ["outdoor", "adventure", "hike", "hiking", "camp", "camping", "trail", "backpack", "explore", "climbing", "fishing"],
  "art & crafts": ["art", "craft", "paint", "painting", "drawing", "sketch", "diy", "knit", "knitting", "pottery", "calligraphy", "embroidery", "creative"],
  "music & instruments": ["music", "instrument", "guitar", "piano", "vinyl", "record", "headphone", "speaker", "audio", "turntable", "ukulele"],
  gaming: ["gaming", "game", "gamer", "console", "controller", "playstation", "xbox", "nintendo", "switch", "puzzle", "board game", "arcade", "dice"],
  gardening: ["garden", "gardening", "plant", "herb", "seed", "planter", "succulent", "botanical", "grow", "greenhouse", "bonsai"],
  "movies & tv": ["movie", "film", "cinema", "tv", "streaming", "projector", "popcorn", "blu-ray", "series"],
  travel: ["travel", "luggage", "suitcase", "passport", "trip", "map", "journey", "voyage", "packing", "carry-on"],
  pets: ["pet", "dog", "cat", "puppy", "kitten", "paw", "leash", "collar", "kennel", "aquarium"],
  "home decor": ["decor", "decoration", "candle", "vase", "frame", "wall art", "cushion", "throw", "ornament", "lamp", "print", "sculpture", "flower"],
};

const MAX_SCORE_FLOOR = 1; // never divide by zero

function normalizeText(value: string): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Values in the catalogue aren't always clean — some rows carry a leading space
// (" anniversary") or different casing. Comparing normalized forms means a data
// typo can't silently cost a gift its points.
const normKey = (value: string) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function listIncludes(list: string[] | null | undefined, value: string): boolean {
  if (!list || !value) return false;
  const target = normKey(value);
  return list.some((item) => normKey(item) === target);
}

// Whole-word match. Interest vocabulary contains short words like "ring" and
// "art" that would otherwise match inside "watering can" or "party".
function containsWord(haystack: string, word: string): boolean {
  const w = word.trim();
  if (!w) return false;
  return new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(haystack);
}

function tokenMatchesHaystack(token: string, haystack: string): boolean {
  if (haystack.includes(token)) {
    return true;
  }

  if (token.length > 3 && token.endsWith("s") && haystack.includes(token.slice(0, -1))) {
    return true;
  }

  if (token.length > 3 && !token.endsWith("s") && haystack.includes(`${token}s`)) {
    return true;
  }

  return false;
}

function getThemeSignals(text: string): string[] {
  const normalized = normalizeText(text);
  const aliases: Record<string, string[]> = {
    books: ["book", "books", "reading", "novel", "literature", "library"],
    food: ["cook", "cooking", "food", "kitchen", "baking", "coffee", "tea"],
    travel: ["travel", "trip", "adventure", "wander", "explore", "holiday"],
    home: ["home", "decor", "cozy", "comfort", "candle", "house", "bath", "bathroom", "towel", "towels", "linens"],
    tech: ["tech", "gadget", "device", "digital", "smart", "electronics"],
    wellness: ["wellness", "wellbeing", "fitness", "spa", "selfcare", "relax"],
    fashion: ["fashion", "style", "clothes", "accessories", "beauty"],
    sport: ["sport", "active", "gym", "outdoor", "running", "hike"],
  };

  return Object.entries(aliases)
    .filter(([, words]) => words.some((word) => normalized.includes(word)))
    .map(([signal]) => signal);
}

const BUDGET_BANDS: Record<string, [number, number]> = {
  "under-25": [0, 25],
  "25-50": [25, 50],
  "50-100": [50, 100],
  "100-200": [100, 200],
};

// A small, deterministic shuffle so equally-good gifts take turns across
// quizzes instead of the same three winning forever on table order.
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getRecommendations(
  answers: QuizAnswers,
  catalogue: Gift[],
  options: { seed?: number; limit?: number } = {},
): GiftScore[] {
  const limit = options.limit ?? 3;
  const seed = options.seed ?? 1;

  const freeText = (answers.freeText || "").trim().toLowerCase();
  const freeTextTokens = freeText
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => token.length > 2);

  const interests = (answers.interests ?? []).filter(Boolean);
  const interestsText = interests.join(" ");
  const combinedSignalText = [freeText, interestsText].filter(Boolean).join(" ");
  const themeSignals = getThemeSignals(combinedSignalText);

  // 1. Filter by budget
  const filteredGifts = catalogue.filter(gift => {
    switch (answers.budget) {
      case 'under-25':
        return gift.price_min < 25;
      case '25-50':
        return gift.price_max >= 25 && gift.price_min <= 50;
      case '50-100':
        return gift.price_max >= 50 && gift.price_min <= 100;
      case '100-200':
        return gift.price_max >= 100 && gift.price_min <= 200;
      case 'no-limit':
        return true;
      default:
        return true;
    }
  });

  // 1b. Exclude gifts marked for the opposite gender. Relationship (recipient)
  //     and gender are separate answers, so a men's item must be filtered by
  //     gender even when the relationship (friend/sibling) matches. 'unisex'
  //     and unmarked gifts always qualify; an "unknown" quiz gender skips this.
  const wantGender = (answers.gender || "").toLowerCase();
  const genderedGifts = filteredGifts.filter(gift => {
    const g = (gift.gender || "unisex").toLowerCase();
    if (g === "unisex") return true;
    if (wantGender === "male") return g === "male";
    if (wantGender === "female") return g === "female";
    return true; // "unknown" or unset quiz gender → no gender filtering
  });

  // The best score these answers could possibly produce, so the percentage
  // means "how close to a perfect match", not a share of an arbitrary constant.
  const maxPossible = Math.max(
    MAX_SCORE_FLOOR,
    W.interestExact * Math.min(interests.length, W.maxInterests) +
      (answers.recipient ? W.recipient : 0) +
      (answers.occasion ? W.occasion : 0) +
      (freeTextTokens.length > 0 ? Math.min(freeTextTokens.length, 4) * W.freeTextToken : 0) +
      (themeSignals.length > 0 ? Math.min(themeSignals.length, 3) * W.themeSignal : 0) +
      (freeTextTokens.length > 0 || themeSignals.length > 0 ? W.signalBonus : 0) +
      W.priceFit +
      W.purchasable,
  );

  // 2. Score remaining gifts
  const scoredGifts: GiftScore[] = genderedGifts.map(gift => {
    let score = 0;
    const reasons: string[] = [];

    const haystack = [gift.name, gift.description, ...(gift.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // Interests — the strongest signal. An exact tag scores full marks; the
    // interest's vocabulary appearing in the name/description scores half, so
    // an untagged-but-obviously-relevant gift still surfaces.
    let interestHits = 0;
    for (const interest of interests.slice(0, W.maxInterests)) {
      if (listIncludes(gift.tags, interest)) {
        score += W.interestExact;
        interestHits++;
        reasons.push(`tagged ${interest}`);
        continue;
      }
      const vocab = INTEREST_VOCAB[normKey(interest)] ?? INTEREST_VOCAB[interest] ?? [];
      if (vocab.some((word) => containsWord(haystack, word))) {
        score += W.interestPartial;
        interestHits++;
        reasons.push(`relevant to ${interest}`);
      }
    }

    if (listIncludes(gift.recipients, answers.recipient)) {
      score += W.recipient;
      reasons.push(`suits ${answers.recipient}`);
    }

    if (listIncludes(gift.occasions, answers.occasion)) {
      score += W.occasion;
      reasons.push(`fits ${answers.occasion}`);
    }

    // Free-text hints should be visible even with a small catalogue.
    if (freeTextTokens.length > 0 || themeSignals.length > 0) {
      const matchingTokens = freeTextTokens.filter((token) => tokenMatchesHaystack(token, haystack));
      const matchingThemes = themeSignals.filter((signal) => tokenMatchesHaystack(signal, haystack));

      score += Math.min(matchingTokens.length, 4) * W.freeTextToken;
      score += Math.min(matchingThemes.length, 3) * W.themeSignal;

      if (matchingTokens.length > 0 || matchingThemes.length > 0) {
        score += W.signalBonus;
        reasons.push("matches what you described");
      }
    }

    // Price comfortably inside the chosen band beats scraping its edge.
    const band = BUDGET_BANDS[answers.budget];
    if (band) {
      const [lo, hi] = band;
      const mid = (gift.price_min + gift.price_max) / 2;
      if (mid >= lo && mid <= hi) {
        score += W.priceFit;
        reasons.push("priced right for your budget");
      }
    }

    // Prefer something the buyer can actually click through and buy.
    if (gift.slug || gift.destination_url || gift.affiliate_url) {
      score += W.purchasable;
    }

    return {
      gift,
      score,
      matchScorePercent: Math.max(0, Math.min(100, Math.round((score / maxPossible) * 100))),
      reasons,
      // Qualified = matched what they told us about the person. With no
      // interests given, matching the relationship or occasion is the best
      // signal available.
      qualified: interests.length > 0
        ? interestHits > 0
        : listIncludes(gift.recipients, answers.recipient) || listIncludes(gift.occasions, answers.occasion),
    };
  });

  // 3. Rank: score first, then break ties on something meaningful rather than
  //    row order — more reasons to recommend it, then a real purchase link.
  const shuffled = seededShuffle(scoredGifts, seed);
  shuffled.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    const aBuy = a.gift.slug || a.gift.destination_url ? 1 : 0;
    const bBuy = b.gift.slug || b.gift.destination_url ? 1 : 0;
    return bBuy - aBuy; // equal-scoring gifts stay in shuffled order
  });

  // 4. Take the top DISTINCT gifts. Deduping by name means duplicate catalogue
  //    rows (e.g. the same gift imported twice) can never fill more than one
  //    slot, so a buyer never sees the same suggestion repeated.
  const seen = new Set<string>();
  const pick = (pool: GiftScore[]) => {
    const out: GiftScore[] = [];
    for (const scored of pool) {
      const key = (scored.gift.name || "").trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(scored);
      if (out.length === limit) break;
    }
    return out;
  };

  // Prefer genuine matches, and return FEWER rather than padding the list with
  // gifts that don't match what the shopper asked for. Only when nothing
  // qualifies at all do we fall back, so the quiz never dead-ends.
  const qualified = pick(shuffled.filter((s) => s.qualified));
  if (qualified.length > 0) return qualified;
  return pick(shuffled);
}
