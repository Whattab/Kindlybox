// Canonical quiz vocabulary — the single source of truth for the values the
// recommendation scorer understands. MUST stay in sync with the option ids in
// src/components/quiz/QuizFlow.tsx. Both the admin add/edit form and the CSV
// bulk importer validate against these, so a typo can never reach the catalog.

export const TAGS = [
  "tech & gadgets", "fashion & accessories", "books & reading", "home & kitchen",
  "fitness & wellness", "outdoor/ adventure", "art & crafts", "music & instruments",
  "gaming", "gardening", "movies & tv", "travel", "pets", "home decor",
] as const;

export const OCCASIONS = [
  "birthday", "anniversary", "graduation", "baby shower", "wedding",
  "valentine's day", "promotion/retirement", "house warming", "mother's day", "father's day",
] as const;

export const RECIPIENTS = [
  "him", "her", "parent", "child", "sibling", "co-worker", "teacher/mentor", "friend",
] as const;

export const AFFILIATE_NETWORKS = ["amazon", "awin", "etsy", "other"] as const;

// Who a gift is for, gender-wise. 'unisex' is the safe default; only mark a
// gift 'male'/'female' when it's clearly gendered.
export const GENDERS = ["male", "female", "unisex"] as const;

// ── Forgiving matching ───────────────────────────────────────────────────────
// Humans filling a spreadsheet type "Travel", "Fashion & Accessories", or
// "outdoor/adventure" — not the exact lowercase, oddly-spaced canonical values.
// We match on a normalized key (lowercase, strip everything but a-z0-9) so case,
// spacing, and punctuation differences all resolve to the canonical value, which
// is what actually gets stored (so the scorer still sees the exact strings).
// Genuine typos ("Gadggets", "Fintness") don't match — for those we suggest the
// closest canonical value instead of just rejecting.

export type VocabMatch = { value: string | null; suggestion: string | null };

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildMap(values: readonly string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const v of values) m.set(normKey(v), v);
  return m;
}

const TAG_MAP = buildMap(TAGS);
const OCCASION_MAP = buildMap(OCCASIONS);
const RECIPIENT_MAP = buildMap(RECIPIENTS);
const GENDER_MAP = buildMap(GENDERS);

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function matchVocab(map: Map<string, string>, raw: string): VocabMatch {
  const key = normKey(raw);
  const exact = map.get(key);
  if (exact) return { value: exact, suggestion: null };
  // No exact (normalized) match — offer the closest canonical value for typos.
  let best: string | null = null;
  let bestDist = Infinity;
  map.forEach((v, k) => {
    const d = levenshtein(key, k);
    if (d < bestDist) { bestDist = d; best = v; }
  });
  // Only suggest when it's plausibly the same word (short edit distance).
  const suggestion = best && bestDist <= Math.max(2, Math.ceil(key.length * 0.34)) ? best : null;
  return { value: null, suggestion };
}

export function canonicalTag(raw: string): VocabMatch {
  return matchVocab(TAG_MAP, raw);
}
export function canonicalOccasion(raw: string): VocabMatch {
  return matchVocab(OCCASION_MAP, raw);
}
export function canonicalRecipient(raw: string): VocabMatch {
  return matchVocab(RECIPIENT_MAP, raw);
}
export function canonicalGender(raw: string): VocabMatch {
  return matchVocab(GENDER_MAP, raw);
}
