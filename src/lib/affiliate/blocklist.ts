// Keyword blocklist for feed products (Step 1 + redesigned in Step 3c).
//
// Two tiers plus a merchant-aware trademark tier (owner-reviewed):
//   HARD      → product is REJECTED (slurs, explicit sexual, hate/extremist,
//               restricted substances, medical CLAIM phrases)
//   REVIEW    → product is STAGED for owner review (mild profanity, partisan
//               political slogans/names, recreational-drug refs)
//   TRADEMARK → REJECTED only on UNtrusted merchants (counterfeit/POD risk);
//               authorized retailers keep genuine branded goods (real Gucci
//               watches, official gift cards).
//
// HOW TO EDIT: add/remove plain words or phrases in the arrays below. Matching
// is WHOLE-WORD and case-insensitive (so "bass"/"glass" aren't hit by short
// words, and bare "treats"/"heals" don't fire). Multi-word phrases match as
// adjacent whole words. Patriotic/general words (freedom, america, patriot,
// vote, usa, veteran…) are intentionally NOT listed and must stay unblocked.

import { isTrustedMerchant } from "./trusted-merchants";

// ── HARD: auto-reject ───────────────────────────────────────────────────────
const SLURS = ["nigger", "faggot", "fag", "kike", "spic", "chink", "tranny", "retard", "coon", "wetback", "dyke"];
const EXPLICIT = ["porn", "pornographic", "dildo", "vibrator", "sex toy", "sex toys", "butt plug", "fetish", "bdsm", "nsfw", "cunt"];
const HATE = ["nazi", "swastika", "kkk", "white power", "white pride", "confederate flag", "qanon"];
const RESTRICTED = ["cocaine", "meth", "heroin", "cbd", "thc"];
const MEDICAL_PHRASES = ["clinically proven", "fda approved", "detox", "weight loss", "fat burner", "boosts immunity", "anti-aging", "miracle cure"];

export const HARD = [...SLURS, ...EXPLICIT, ...HATE, ...RESTRICTED, ...MEDICAL_PHRASES];

// Medical CLAIM: a claim verb immediately followed by a condition, so "dog
// treats" and "Hope Heals" (no condition after) are safe.
const MEDICAL_CLAIM_RE =
  /\b(cure[sd]?|treat[s]?|heal[s]?|prevent[s]?)\s+(cancer|diabetes|arthritis|anxiety|depression|pain|insomnia|infection|covid|disease|illness)\b/i;

// ── REVIEW: send to staged for owner approval ───────────────────────────────
const MILD_PROFANITY = ["fuck", "shit", "bitch", "asshole", "dick", "pussy", "slut", "whore", "middle finger", "damn", "crap", "bastard"];
const PARTISAN = ["trump", "biden", "obama", "kamala", "kamala harris", "maga", "lets go brandon", "ridin with biden", "democrat", "republican", "liberal", "conservative", "antifa", "pro-life", "pro-choice", "blue lives matter", "defund"];
const REC_DRUGS = ["weed", "marijuana", "cannabis", "420", "bong", "rolling papers", "stoner"];

export const REVIEW = [...MILD_PROFANITY, ...PARTISAN, ...REC_DRUGS];

// ── TRADEMARK: reject only on untrusted merchants ───────────────────────────
export const TRADEMARK = [
  "disney", "mickey mouse", "minnie", "marvel", "avengers", "spider-man", "spiderman",
  "star wars", "baby yoda", "mandalorian", "harry potter", "hogwarts", "pokemon",
  "pikachu", "nintendo", "mario", "zelda", "hello kitty", "sanrio", "pixar",
  "frozen", "elsa", "barbie", "lego", "nike", "adidas", "gucci", "louis vuitton",
  "chanel", "prada", "supreme", "nfl", "nba", "mlb", "nhl", "taylor swift", "bts",
  "squid game", "stranger things", "bluey", "paw patrol", "minecraft", "fortnite",
  "sonic", "dr seuss", "winnie the pooh", "snoopy",
];

// Normalize to " token token " form so includes() is whole-word / whole-phrase.
function norm(value: string): string {
  return " " + value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") + " ";
}
const normList = (terms: string[]) => terms.map(norm);
const HARD_N = normList(HARD);
const REVIEW_N = normList(REVIEW);
const TRADEMARK_N = normList(TRADEMARK);
const anyHit = (normedTerms: string[], title: string) => {
  const hay = norm(title);
  return normedTerms.some((t) => hay.includes(t));
};

/** Slurs, explicit, hate, restricted substances, or a medical claim → reject. */
export function isHardBlocked(title: string | null | undefined): boolean {
  if (!title) return false;
  return anyHit(HARD_N, title) || MEDICAL_CLAIM_RE.test(title);
}

/** Mild profanity, partisan political, or recreational drugs → stage for review. */
export function isReviewFlagged(title: string | null | undefined): boolean {
  if (!title) return false;
  return anyHit(REVIEW_N, title);
}

/** Trademarked brand/character name (counterfeit risk on untrusted merchants). */
export function isTrademarkBlocked(title: string | null | undefined): boolean {
  if (!title) return false;
  return anyHit(TRADEMARK_N, title);
}

/** Overall "should this title be kept out of the quiz?" — hard/review always,
 *  trademark only when the merchant isn't a trusted authorized retailer. Used
 *  as a defense-in-depth filter in the quiz candidate loader. */
export function isBlockedTitle(title: string | null | undefined, merchant?: string | null): boolean {
  if (!title) return false;
  return isHardBlocked(title) || isReviewFlagged(title) || (isTrademarkBlocked(title) && !isTrustedMerchant(merchant));
}
