// Branching quiz (Step 6, decisions §4) — the question graph as DATA.
//
// Pure (no React, no Supabase) so the UI (Step 6b), the answer mapper, the sim
// and the tests all share one definition. Which screens show, and which options
// each offers, depend on earlier answers. Labels here are shopper-facing; the
// mapper (./map.ts) turns answers into the recommender's existing vocabulary.

export type Relationship =
  | "partner" | "mom" | "dad" | "friend" | "sibling" | "grandparent" | "child" | "coworker" | "someone else";
export type LifeStage = "baby" | "toddler" | "kid" | "tween" | "teen" | "20s" | "30s-40s" | "50s-60s" | "70+";
export type GenderChoice = "him" | "her" | "either";
export type OccasionV2 =
  | "birthday" | "holidays" | "thank you" | "housewarming" | "retirement" | "wedding" | "new baby"
  | "sympathy" | "just because" | "anniversary" | "valentine's day" | "graduation" | "mother's day" | "father's day";
export type Saturday =
  | "outdoors" | "kitchen" | "relaxing" | "gadgets" | "making" | "active" | "reading" | "hosting" | "traveling" | "pets";
export type Level = "beginner" | "enthusiast" | "expert";
export type Feel = "practical" | "sentimental" | "treat" | "fun" | "experience" | "surprise";
export type Budget = "under-25" | "25-50" | "50-100" | "100-200" | "no-limit";

export interface V2State {
  relationship: Relationship | "";
  lifeStage: LifeStage | "";
  gender: GenderChoice | "";
  recipientName: string;
  occasion: OccasionV2 | "";
  saturday: Saturday[];  // up to 2
  depth: string[];       // depth option ids (= taxonomy interest labels)
  level: Level | "";
  feel: Feel | "";
  budget: Budget | "";
  avoids: string[];      // taxonomy avoid_flag labels
  freeText: string;
}

export const EMPTY_STATE: V2State = {
  relationship: "", lifeStage: "", gender: "", recipientName: "", occasion: "",
  saturday: [], depth: [], level: "", feel: "", budget: "", avoids: [], freeText: "",
};

/** Runtime facts the graph can't know on its own. */
export interface GraphContext {
  /** Depth options with enough approved products (10+). Undefined = all available. */
  depthAvailable?: ReadonlySet<string>;
}

export interface Option<T extends string = string> { id: T; label: string }

export const MAX_SATURDAY = 2;
export const MIN_DEPTH_PRODUCTS = 10;

// ── S1 — who + life stage ─────────────────────────────────────────────────
export const RELATIONSHIPS: Option<Relationship>[] = [
  { id: "partner", label: "Partner" },
  { id: "mom", label: "Mom" },
  { id: "dad", label: "Dad" },
  { id: "friend", label: "Friend" },
  { id: "sibling", label: "Sibling" },
  { id: "grandparent", label: "Grandparent" },
  { id: "child", label: "Child" },
  { id: "coworker", label: "Coworker / Boss" },
  { id: "someone else", label: "Someone else" },
];

const CHILD_STAGES: Option<LifeStage>[] = [
  { id: "baby", label: "Baby" },
  { id: "toddler", label: "Toddler" },
  { id: "kid", label: "Kid" },
  { id: "tween", label: "Tween" },
  { id: "teen", label: "Teen" },
];
const ADULT_STAGES: Option<LifeStage>[] = [
  { id: "20s", label: "20s" },
  { id: "30s-40s", label: "30s–40s" },
  { id: "50s-60s", label: "50s–60s" },
  { id: "70+", label: "70+" },
];

export function lifeStageOptions(s: V2State): Option<LifeStage>[] {
  if (!s.relationship) return [];
  if (s.relationship === "child") return CHILD_STAGES;
  if (s.relationship === "grandparent") return ADULT_STAGES.filter((o) => o.id === "50s-60s" || o.id === "70+");
  return ADULT_STAGES;
}

/** A child's age changes everything; for adults it's an optional refinement. */
export const lifeStageRequired = (s: V2State) => s.relationship === "child";

export const GENDERS: Option<GenderChoice>[] = [
  { id: "him", label: "For him" },
  { id: "her", label: "For her" },
  { id: "either", label: "Either" },
];
/** Mom/dad already imply it; everyone else gets the optional chip. */
export const genderShown = (s: V2State) => !!s.relationship && s.relationship !== "mom" && s.relationship !== "dad";

// ── S2 — occasion (options depend on S1) ──────────────────────────────────
const BASE_OCCASIONS: Option<OccasionV2>[] = [
  { id: "birthday", label: "Birthday" },
  { id: "holidays", label: "Holidays" },
  { id: "thank you", label: "Thank you" },
  { id: "housewarming", label: "Housewarming" },
  { id: "retirement", label: "Retirement" },
  { id: "wedding", label: "Wedding" },
  { id: "new baby", label: "New baby" },
  { id: "sympathy", label: "Sympathy" },
  { id: "just because", label: "Just because" },
];

export function occasionOptions(s: V2State): Option<OccasionV2>[] {
  const out: Option<OccasionV2>[] = [];
  if (s.relationship === "partner") {
    out.push({ id: "anniversary", label: "Anniversary" }, { id: "valentine's day", label: "Valentine's Day" });
  }
  if (s.relationship === "mom") out.push({ id: "mother's day", label: "Mother's Day" });
  if (s.relationship === "dad") out.push({ id: "father's day", label: "Father's Day" });
  if (s.relationship === "child" || s.lifeStage === "teen" || s.lifeStage === "20s") {
    out.push({ id: "graduation", label: "Graduation" });
  }
  // Retirement makes no sense for a child.
  const base = s.relationship === "child" ? BASE_OCCASIONS.filter((o) => o.id !== "retirement") : BASE_OCCASIONS;
  return [...base.slice(0, 1), ...out, ...base.slice(1)];
}

/** Sympathy skips the hobby questions (S3–S4) and never offers "fun". */
export const isSympathy = (s: V2State) => s.occasion === "sympathy";

// ── S3 — "How do they spend a free Saturday?" (up to 2) ───────────────────
export const SATURDAYS: Option<Saturday>[] = [
  { id: "outdoors", label: "Outdoors" },
  { id: "kitchen", label: "In the kitchen" },
  { id: "relaxing", label: "Relaxing at home" },
  { id: "gadgets", label: "With gadgets" },
  { id: "making", label: "Making / creating" },
  { id: "active", label: "Staying active" },
  { id: "reading", label: "Reading / learning" },
  { id: "hosting", label: "Hosting friends" },
  { id: "traveling", label: "Traveling" },
  { id: "pets", label: "With their pets" },
];

// ── S4 — depth (only for branches with enough products) + level ───────────
// Option ids are taxonomy interest labels (scripts/seed-tags.ts), so they go
// straight into the recommender's `interests`.
export const DEPTH: Partial<Record<Saturday, Option[]>> = {
  outdoors: [
    { id: "fishing", label: "Fishing" },
    { id: "hiking", label: "Hiking" },
    { id: "camping", label: "Camping" },
    { id: "gardening", label: "Gardening" },
    { id: "golf", label: "Golf" },
  ],
  kitchen: [
    { id: "cooking", label: "Cooking" },
    { id: "baking", label: "Baking" },
    { id: "coffee", label: "Coffee" },
    { id: "grilling & bbq", label: "Grilling" },
    { id: "wine & cocktails", label: "Wine & cocktails" },
  ],
  gadgets: [
    { id: "smart home", label: "Smart home" },
    { id: "audio", label: "Audio" },
    { id: "gaming", label: "Gaming" },
    { id: "photography", label: "Photography" },
  ],
};

/** Every depth option id, for counting products per option (Step 6b page). */
export const ALL_DEPTH_IDS: string[] = Object.values(DEPTH).flatMap((opts) => (opts || []).map((o) => o.id));

/** Hobby branches where "how into it are they?" changes the right gift. */
const LEVEL_BRANCHES: Saturday[] = ["outdoors", "kitchen", "gadgets", "making", "active"];

export const LEVELS: Option<Level>[] = [
  { id: "beginner", label: "Just starting" },
  { id: "enthusiast", label: "Enthusiast" },
  { id: "expert", label: "Has all the gear" },
];

export function depthOptions(s: V2State, ctx: GraphContext = {}): Option[] {
  const out: Option[] = [];
  for (const sat of s.saturday) {
    for (const o of DEPTH[sat] || []) {
      // Wine for a child is never right, whatever the product count.
      if (s.relationship === "child" && o.id === "wine & cocktails") continue;
      if (ctx.depthAvailable && !ctx.depthAvailable.has(o.id)) continue;
      if (!out.some((x) => x.id === o.id)) out.push(o);
    }
  }
  return out;
}

export const levelShown = (s: V2State) => s.saturday.some((x) => LEVEL_BRANCHES.includes(x));

// ── S5 — gift feel ────────────────────────────────────────────────────────
const FEELS: Option<Feel>[] = [
  { id: "practical", label: "Practical" },
  { id: "sentimental", label: "Sentimental" },
  { id: "treat", label: "A treat they wouldn't buy themselves" },
  { id: "fun", label: "Fun" },
  { id: "experience", label: "An experience" },
  { id: "surprise", label: "Surprise me" },
];
export const feelOptions = (s: V2State): Option<Feel>[] => (isSympathy(s) ? FEELS.filter((f) => f.id !== "fun") : FEELS);

// ── S6 — budget + avoids ──────────────────────────────────────────────────
export const BUDGETS: Option<Budget>[] = [
  { id: "under-25", label: "Under $25" },
  { id: "25-50", label: "$25 – $50" },
  { id: "50-100", label: "$50 – $100" },
  { id: "100-200", label: "$100 – $200" },
  { id: "no-limit", label: "No limit" },
];
// Labels = taxonomy avoid_flag labels (decisions §3.8).
export const AVOIDS: Option[] = [
  { id: "no alcohol", label: "No alcohol" },
  { id: "minimalist", label: "Minimalist / no clutter" },
  { id: "has everything", label: "Has everything" },
  { id: "scent-sensitive", label: "Scent-sensitive" },
  { id: "dietary needs", label: "Dietary needs" },
  { id: "not into tech", label: "Not into tech" },
];

// ── Screens ───────────────────────────────────────────────────────────────
export type ScreenId = "who" | "occasion" | "saturday" | "depth" | "feel" | "budget" | "note";

export interface Screen {
  id: ScreenId;
  title: (s: V2State) => string;
  show: (s: V2State, ctx: GraphContext) => boolean;
  valid: (s: V2State, ctx: GraphContext) => boolean;
}

const has = <T extends string>(opts: Option<T>[], v: string) => opts.some((o) => o.id === v);

export const SCREENS: Screen[] = [
  {
    id: "who",
    title: () => "Who is the gift for?",
    show: () => true,
    valid: (s) =>
      !!s.relationship &&
      (s.lifeStage ? has(lifeStageOptions(s), s.lifeStage) : !lifeStageRequired(s)),
  },
  {
    id: "occasion",
    title: () => "What's the occasion?",
    show: () => true,
    valid: (s) => has(occasionOptions(s), s.occasion),
  },
  {
    id: "saturday",
    title: () => "How do they spend a free Saturday?",
    show: (s) => !isSympathy(s),
    valid: (s) => s.saturday.length > 0 && s.saturday.length <= MAX_SATURDAY,
  },
  {
    id: "depth",
    title: () => "Tell us a little more",
    show: (s, ctx) => !isSympathy(s) && (depthOptions(s, ctx).length > 0 || levelShown(s)),
    valid: () => true, // both parts optional
  },
  {
    id: "feel",
    title: () => "What kind of gift feels right?",
    show: () => true,
    valid: (s) => has(feelOptions(s), s.feel),
  },
  {
    id: "budget",
    title: () => "What's your budget?",
    show: () => true,
    valid: (s) => has(BUDGETS, s.budget),
  },
  {
    id: "note",
    title: (s) => (s.recipientName.trim() ? `Tell us one thing about ${s.recipientName.trim()}` : "Tell us one thing about them"),
    show: () => true,
    valid: () => true, // optional
  },
];

export function visibleScreens(s: V2State, ctx: GraphContext = {}): Screen[] {
  return SCREENS.filter((scr) => scr.show(s, ctx));
}

/**
 * Drop answers that are no longer offered after an earlier answer changed
 * (e.g. switching partner → friend removes "anniversary"; switching to
 * sympathy clears hobbies). Keeps the state consistent with what's on screen.
 */
export function pruneState(s: V2State, ctx: GraphContext = {}): V2State {
  const out: V2State = { ...s };
  if (out.lifeStage && !has(lifeStageOptions(out), out.lifeStage)) out.lifeStage = "";
  if (!genderShown(out)) out.gender = "";
  if (out.occasion && !has(occasionOptions(out), out.occasion)) out.occasion = "";
  if (isSympathy(out)) {
    out.saturday = [];
    out.depth = [];
    out.level = "";
  }
  out.saturday = out.saturday.filter((x) => has(SATURDAYS, x)).slice(0, MAX_SATURDAY);
  const depthOk = depthOptions(out, ctx);
  out.depth = out.depth.filter((d) => has(depthOk, d));
  if (!levelShown(out)) out.level = "";
  if (out.feel && !has(feelOptions(out), out.feel)) out.feel = "";
  out.avoids = out.avoids.filter((a) => has(AVOIDS, a));
  return out;
}
