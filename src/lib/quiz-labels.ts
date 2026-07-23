// Presentation helpers for the quiz results — rank language, friendly interest
// chips, and pronouns. Kept in one place so the results page and the results
// email always speak the same way (no "Top pick" on the page but "46% Match"
// in the email).

// Honest, rank-only labels. We stopped showing a match percentage because it
// couldn't be justified (see recommend.ts); rank is real and defensible.
export const RANK_LABELS = ["Our top pick", "A close second", "Also worth a look"];

export function rankLabel(index: number): string {
  return RANK_LABELS[index] ?? "Also worth a look";
}

// Warm phrasings for the structured interests, shown as chips on the results
// header. Honest by construction — the buyer actually selected these; we're
// only wording them nicely. Keys match the interest ids in QuizFlow.
const INTEREST_CHIP: Record<string, string> = {
  "tech & gadgets": "Loves gadgets",
  "fashion & accessories": "Into fashion",
  "books & reading": "Cozy nights in",
  "home & kitchen": "Loves cooking",
  "fitness & wellness": "Stays active",
  "outdoor/ adventure": "Outdoorsy",
  "art & crafts": "Crafty at heart",
  "music & instruments": "Music lover",
  gaming: "Gamer",
  gardening: "Plant parent",
  "movies & tv": "Movie buff",
  travel: "Always traveling",
  pets: "Animal lover",
  "home decor": "Home-proud",
};

export function interestChips(interests: unknown): string[] {
  if (!Array.isArray(interests)) return [];
  return interests
    .filter((i): i is string => typeof i === "string")
    .map((i) => INTEREST_CHIP[i] ?? i)
    .slice(0, 3);
}

// Gender → object pronoun for headline copy ("picked for her").
export function pronounFor(gender: unknown): string {
  if (gender === "male") return "him";
  if (gender === "female") return "her";
  return "them";
}
