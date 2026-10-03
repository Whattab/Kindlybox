// Keyword blocklist for feed products (Step 1, see docs/quiz-decisions.md §3.2).
//
// A temporary brand-safety gate: feed products whose TITLE matches any blocked
// term are excluded from quiz candidates. Approved by the owner before use.
// Only affiliate `products` are filtered — curated `gifts` are never touched.
//
// HOW TO EDIT: add or remove plain words/phrases in the category arrays below.
// Matching is WHOLE-WORD and case-insensitive (so "nba" won't hit "Scranton"),
// and multi-word phrases ("mickey mouse") match as adjacent whole words. Edit
// freely — no regex knowledge needed.

// Political / divisive
export const POLITICAL = [
  "trump", "biden", "obama", "kamala", "maga", "lets go brandon", "antifa",
  "qanon", "democrat", "republican", "communist", "nazi", "confederate", "swastika",
];

// Offensive / adult (profanity, explicit, drugs) + slurs
export const OFFENSIVE = [
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "slut", "whore",
  "middle finger", "nsfw", "xxx", "porn", "dildo", "vibrator", "sex toy",
  "bong", "weed", "marijuana", "cannabis", "420", "cocaine",
  // Racial / homophobic / ableist slurs — block outright.
  "faggot", "fag", "retard", "nigger", "spic", "chink", "kike", "tranny",
];

// Unsubstantiated medical / health claims. Deliberately high-precision phrases
// and substances only — bare words like "heal", "cure", "miracle" are omitted
// because they hit legitimate sentimental product names (e.g. a "Hope Heals"
// bouquet) with no real health claim.
export const MEDICAL = [
  "clinically proven", "fda approved", "detox", "anti-aging", "weight loss",
  "fat burner", "boosts immunity", "antibacterial", "antiviral", "cbd", "thc",
  // "treats <condition>" phrasing, NOT bare "treats" (would block pet treats).
  "treats anxiety", "treats pain", "treats depression",
];

// Trademarked brands / characters — counterfeit & IP risk, esp. on
// print-on-demand merchants. Expand as new knockoffs appear.
export const TRADEMARKS = [
  "disney", "mickey mouse", "minnie", "marvel", "avengers", "spider-man", "spiderman",
  "star wars", "baby yoda", "mandalorian", "harry potter", "hogwarts", "pokemon",
  "pikachu", "nintendo", "mario", "zelda", "hello kitty", "sanrio", "pixar",
  "frozen", "elsa", "barbie", "lego", "nike", "adidas", "gucci", "louis vuitton",
  "chanel", "prada", "supreme", "nfl", "nba", "mlb", "nhl", "taylor swift", "bts",
  "squid game", "stranger things", "bluey", "paw patrol", "minecraft", "fortnite",
  "sonic", "dr seuss", "winnie the pooh", "snoopy",
];

export const BLOCKED_TERMS: string[] = [
  ...POLITICAL,
  ...OFFENSIVE,
  ...MEDICAL,
  ...TRADEMARKS,
];

// Normalize to " token token " form: lowercase, non-alphanumerics → single
// spaces, padded with a leading/trailing space. Testing `haystack.includes(needle)`
// on two normalized strings then yields whole-word (and whole-phrase) matching.
function norm(value: string): string {
  return " " + value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") + " ";
}

const NORMALIZED_TERMS = BLOCKED_TERMS.map(norm);

export function isBlockedTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const hay = norm(title);
  return NORMALIZED_TERMS.some((term) => hay.includes(term));
}
