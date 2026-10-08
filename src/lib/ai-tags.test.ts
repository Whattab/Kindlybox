import { describe, it, expect } from "vitest";
import { deterministicTags, finalize, finalizeItemTags, pickPrimaryInterest, type Vocab } from "./ai-tags";
import { withinBudget } from "./recommend";

const vocab: Vocab = {
  interestLabels: ["home & kitchen", "coffee", "baking", "gardening", "pets", "dogs", "fitness & wellness", "yoga"],
  avoidLabels: ["no alcohol", "minimalist", "scent-sensitive"],
  styleLabels: ["practical", "sentimental", "luxe", "fun & quirky", "experience"],
  giftTypeLabels: ["physical", "consumable", "experience", "personalized", "digital"],
  subInterest: new Set(["coffee", "baking", "dogs", "yoga"]),
  synonyms: [
    { phrase: "espresso", label: "coffee", dimension: "interest" },
    { phrase: "sourdough", label: "baking", dimension: "interest" },
    { phrase: "green thumb", label: "gardening", dimension: "interest" },
    { phrase: "puppy", label: "dogs", dimension: "interest" },
  ],
};

describe("deterministicTags", () => {
  it("maps synonyms + literal labels, no false hits", () => {
    expect(deterministicTags("obsessed with espresso", vocab).interests).toContain("coffee");
    expect(deterministicTags("loves coffee and yoga", vocab).interests).toEqual(expect.arrayContaining(["coffee", "yoga"]));
    expect(deterministicTags("no alcohol please", vocab).avoid_flags).toContain("no alcohol");
    expect(deterministicTags("", vocab)).toEqual({ interests: [], avoid_flags: [] });
  });
});

describe("finalize (free-text validation)", () => {
  it("drops out-of-vocab labels and dedupes", () => {
    const out = finalize([{ interests: ["coffee", "coffee", "wizardry"], avoid_flags: ["made up"] }], vocab);
    expect(out.interests).toEqual(["coffee"]);
    expect(out.avoid_flags).toEqual([]);
  });
});

describe("pickPrimaryInterest", () => {
  it("prefers a sub-interest, else the first", () => {
    expect(pickPrimaryInterest(["home & kitchen", "coffee"], vocab)).toBe("coffee");
    expect(pickPrimaryInterest(["gardening"], vocab)).toBe("gardening");
    expect(pickPrimaryInterest([], vocab)).toBeNull();
  });
});

describe("finalizeItemTags", () => {
  it("coffee grinder → coffee + primary coffee, hallucinated style dropped", () => {
    const det = deterministicTags("OXO Conical Burr Coffee Grinder", vocab);
    const out = finalizeItemTags([det, { style: ["practical", "made-up-style"], gift_type: ["physical"] }], vocab);
    expect(out.interests).toContain("coffee");
    expect(out.primary_interest).toBe("coffee");
    expect(out.style).toEqual(["practical"]);
    expect(out.gift_type).toEqual(["physical"]);
  });
});

describe("withinBudget (ceiling, not band)", () => {
  it("includes cheaper relevant items under a high ceiling", () => {
    expect(withinBudget(40, "100-200")).toBe(true);   // cheap item, high budget → kept
    expect(withinBudget(20, "under-25")).toBe(true);
    expect(withinBudget(90, "no-limit")).toBe(true);
  });
  it("excludes items priced above the ceiling", () => {
    expect(withinBudget(150, "50-100")).toBe(false);
    expect(withinBudget(300, "100-200")).toBe(false);
  });
});
