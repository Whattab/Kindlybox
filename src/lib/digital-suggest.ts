// Picks the best-fit KindlyBox digital extra (custom song / greeting card /
// bundle) to surface on the quiz results — the site's own high-margin, unique
// product, which the affiliate matcher never sees. Tuned by occasion + the
// emotional tone of the buyer's free-text.

import type { QuizAnswers } from "./recommend";

export interface DigitalSuggestion {
  service: "song" | "card" | "bundle";
  name: string;
  price: number; // dollars
  href: string;
  headline: string;
  blurb: string;
}

// Emotional / sentimental cues in the free-text that argue for the full bundle.
const EMOTIONAL = [
  "love", "loves", "memories", "memory", "special", "story", "miss", "misses",
  "far", "distance", "apart", "heart", "forever", "together", "years", "journey",
  "meaningful", "sentimental", "cherish", "grateful", "everything to me",
];

const META = {
  song: { name: "Custom Song", price: 15, href: "/extras/song" },
  card: { name: "Greeting Card", price: 10, href: "/extras/card" },
  bundle: { name: "Song + Card Bundle", price: 25, href: "/extras/bundle" },
} as const;

export function suggestDigitalExtra(answers: QuizAnswers): DigitalSuggestion {
  const occ = (answers.occasion || "").toLowerCase();
  const free = (answers.freeText || "").toLowerCase();
  const emotional = EMOTIONAL.some((w) => free.includes(w));
  const them = answers.recipientName?.trim() || "them";

  // The most sentimental moments (or an emotional note) → the full bundle.
  let service: "song" | "card" | "bundle";
  if (["anniversary", "valentine's day", "wedding"].includes(occ) || emotional) {
    service = "bundle";
  } else if (["birthday", "mother's day", "father's day", "graduation", "promotion/retirement"].includes(occ)) {
    service = "song";
  } else {
    service = "card";
  }

  const meta = META[service];
  const headline =
    service === "bundle" ? `Make it unforgettable for ${them}`
    : service === "song" ? `Give ${them} a gift no one else can`
    : `Say it in your own words to ${them}`;
  const blurb =
    service === "bundle"
      ? "A custom song written around your story, plus a matching card in your exact words — the most personal gift you can give."
      : service === "song"
      ? `An original song, written and produced just for ${them} — from their names, your story, and the occasion.`
      : "A beautiful digital card featuring your exact message, themed to the occasion and ready to send.";

  return { service, name: meta.name, price: meta.price, href: meta.href, headline, blurb };
}
