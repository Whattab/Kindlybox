// Branching quiz (Step 6) — answer mapping.
//
// Turns v2 answers (./graph.ts) into the recommender's existing `QuizAnswers`,
// so recommend.ts, the candidate loader, personalize and the results page work
// unchanged. Also normalises URL prefill from reminder emails / the dashboard /
// old v1 links into a partial v2 state.

import type { QuizAnswers } from "../recommend";
import {
  EMPTY_STATE, MAX_SATURDAY, pruneState,
  type Budget, type GraphContext, type LifeStage, type OccasionV2, type Relationship, type Saturday, type V2State,
} from "./graph";

// ── answers → recommender ─────────────────────────────────────────────────

// Each Saturday branch → taxonomy interest labels (broadest first).
export const SATURDAY_INTERESTS: Record<Saturday, string[]> = {
  outdoors: ["outdoor/ adventure"],
  kitchen: ["home & kitchen"],
  relaxing: ["home decor", "self-care"],
  gadgets: ["tech & gadgets"],
  making: ["art & crafts"],
  active: ["fitness & wellness"],
  reading: ["books & reading"],
  hosting: ["home & kitchen", "board games"],
  traveling: ["travel"],
  pets: ["pets"],
};

// Catalogue occasion labels differ from the shopper-facing ones in a few places.
const OCCASION_TO_CATALOGUE: Partial<Record<OccasionV2, string>> = {
  housewarming: "house warming",
  retirement: "promotion/retirement",
  "new baby": "baby shower",
};

// Life stages → recommender age groups. Children collapse to the existing kid
// buckets; adult stages are their own (recommend.ts AGE_RANGES).
const STAGE_TO_AGE: Record<LifeStage, string> = {
  baby: "under12", toddler: "under12", kid: "under12", tween: "under12",
  teen: "13-19", "20s": "20s", "30s-40s": "30s-40s", "50s-60s": "50s-60s", "70+": "70+",
};

function genderOf(s: V2State): "male" | "female" | "unknown" {
  if (s.relationship === "mom") return "female";
  if (s.relationship === "dad") return "male";
  if (s.gender === "him") return "male";
  if (s.gender === "her") return "female";
  return "unknown";
}

// Catalogue recipient tags: him, her, parent, child, sibling, co-worker,
// teacher/mentor, friend. "him"/"her" are the generic adult buckets.
function recipientOf(s: V2State): string {
  const byGender = s.gender === "him" ? "him" : s.gender === "her" ? "her" : "";
  switch (s.relationship) {
    case "mom": case "dad": case "grandparent": return "parent";
    case "child": return "child";
    case "sibling": return "sibling";
    case "friend": return "friend";
    case "coworker": return "co-worker";
    case "partner": case "someone else": return byGender;
    default: return "";
  }
}

/**
 * Interests, most specific first: chosen depth options, then each Saturday
 * branch's root(s). Deduped and capped to what the scorer reads (5).
 */
function interestsOf(s: V2State): string[] {
  const out = [...s.depth];
  for (const sat of s.saturday) out.push(...SATURDAY_INTERESTS[sat]);
  return Array.from(new Set(out)).slice(0, 5);
}

export function toQuizAnswers(state: V2State, ctx: GraphContext = {}): QuizAnswers {
  const s = pruneState(state, ctx);
  const isChild = s.relationship === "child";
  const avoidFlags = new Set(s.avoids);
  // Decisions §4 rules: child → no alcohol, romance or luxe; coworker → nothing intimate.
  if (isChild) avoidFlags.add("no alcohol");

  return {
    recipient: recipientOf(s),
    occasion: s.occasion ? OCCASION_TO_CATALOGUE[s.occasion] ?? s.occasion : "",
    interests: interestsOf(s),
    budget: s.budget || "no-limit",
    ageGroup: s.lifeStage ? STAGE_TO_AGE[s.lifeStage] : "",
    gender: genderOf(s),
    freeText: s.freeText.trim() || undefined,
    recipientName: s.recipientName.trim() || undefined,
    avoidFlags: Array.from(avoidFlags),
    giftFeel: s.feel && s.feel !== "surprise" ? s.feel : undefined,
    experienceLevel: s.level || undefined,
    excludeIntimate: isChild || s.relationship === "coworker" || undefined,
    excludeLuxe: isChild || undefined,
  };
}

// ── URL prefill → partial v2 state ────────────────────────────────────────
// Sources: reminder emails (occasions table: partner/parent/child/friend/
// sibling/colleague/other; birthday/anniversary/christmas/wedding/new baby/
// graduation/housewarming/just because/other), the dashboard, and v1 links.

const RELATIONSHIP_IN: Record<string, Relationship> = {
  partner: "partner", spouse: "partner",
  mom: "mom", mother: "mom", dad: "dad", father: "dad",
  friend: "friend", sibling: "sibling", grandparent: "grandparent", child: "child",
  coworker: "coworker", "co-worker": "coworker", colleague: "coworker",
  "teacher/mentor": "someone else", other: "someone else", "someone else": "someone else",
};

const OCCASION_IN: Record<string, OccasionV2> = {
  birthday: "birthday", anniversary: "anniversary", wedding: "wedding", graduation: "graduation",
  christmas: "holidays", holidays: "holidays", holiday: "holidays",
  "new baby": "new baby", "baby shower": "new baby",
  housewarming: "housewarming", "house warming": "housewarming",
  retirement: "retirement", "promotion/retirement": "retirement",
  "valentine's day": "valentine's day", "mother's day": "mother's day", "father's day": "father's day",
  "thank you": "thank you", sympathy: "sympathy", "just because": "just because",
};

const AGE_IN: Record<string, LifeStage> = {
  "13-19": "teen", "20s": "20s", "30s": "30s-40s", "40s": "30s-40s",
};

// v1 interest labels → Saturday branch.
const INTEREST_IN: Record<string, Saturday> = {
  "outdoor/ adventure": "outdoors", gardening: "outdoors",
  "home & kitchen": "kitchen",
  "tech & gadgets": "gadgets", gaming: "gadgets",
  "art & crafts": "making",
  "fitness & wellness": "active",
  "books & reading": "reading",
  travel: "traveling", pets: "pets", "home decor": "relaxing",
};

const BUDGETS_IN: Budget[] = ["under-25", "25-50", "50-100", "100-200", "no-limit"];

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string) => {
  const v = p[k];
  return ((typeof v === "string" ? v : Array.isArray(v) ? v[0] : "") || "").trim().toLowerCase();
};

/**
 * Turn `/quiz?...` params into a v2 starting state. Unknown values are dropped
 * rather than guessed (e.g. v1 "parent" doesn't say mom or dad), and the result
 * is pruned so it's always consistent with the graph.
 */
export function prefillFromParams(params: Params): V2State {
  const s: V2State = { ...EMPTY_STATE, saturday: [], depth: [], avoids: [] };

  const rel = one(params, "recipient");
  if (RELATIONSHIP_IN[rel]) s.relationship = RELATIONSHIP_IN[rel];
  // v1 "him"/"her" were the generic adult buckets: gender, no specific
  // relationship — the closest v2 equivalent is "someone else" + gender.
  if (rel === "him" || rel === "her") s.relationship = "someone else";
  const g = one(params, "gender");
  if (rel === "him" || g === "male") s.gender = "him";
  if (rel === "her" || g === "female") s.gender = "her";

  const occ = one(params, "occasion");
  if (OCCASION_IN[occ]) s.occasion = OCCASION_IN[occ];

  const budget = one(params, "budget") as Budget;
  if (BUDGETS_IN.includes(budget)) s.budget = budget;

  const age = one(params, "ageGroup");
  if (AGE_IN[age]) s.lifeStage = AGE_IN[age];

  const interests = one(params, "interests").split(",").map((x) => x.trim()).filter(Boolean);
  for (const i of interests) {
    const sat = INTEREST_IN[i];
    if (sat && !s.saturday.includes(sat) && s.saturday.length < MAX_SATURDAY) s.saturday.push(sat);
  }

  return pruneState(s);
}
