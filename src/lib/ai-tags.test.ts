import { describe, it, expect } from "vitest";
import { deterministicTags, finalize, type Vocab } from "./ai-tags";

const vocab: Vocab = {
  interestLabels: ["home & kitchen", "coffee", "baking", "gardening", "pets", "dogs", "fitness & wellness", "yoga"],
  avoidLabels: ["no alcohol", "minimalist", "scent-sensitive"],
  synonyms: [
    { phrase: "espresso", label: "coffee", dimension: "interest" },
    { phrase: "barista", label: "coffee", dimension: "interest" },
    { phrase: "sourdough", label: "baking", dimension: "interest" },
    { phrase: "green thumb", label: "gardening", dimension: "interest" },
    { phrase: "puppy", label: "dogs", dimension: "interest" },
    { phrase: "yogi", label: "yoga", dimension: "interest" },
  ],
};

describe("deterministicTags", () => {
  it("maps synonyms to their tag", () => {
    expect(deterministicTags("she's obsessed with espresso", vocab).interests).toContain("coffee");
    expect(deterministicTags("always baking sourdough", vocab).interests).toEqual(expect.arrayContaining(["baking"]));
    expect(deterministicTags("total green thumb", vocab).interests).toContain("gardening");
  });
  it("matches literal interest labels (whole-word)", () => {
    expect(deterministicTags("loves coffee and yoga", vocab).interests).toEqual(expect.arrayContaining(["coffee", "yoga"]));
    expect(deterministicTags("communicates well", vocab).interests).not.toContain("cats"); // not a false hit
  });
  it("picks up avoid flags", () => {
    expect(deterministicTags("no alcohol please", vocab).avoid_flags).toContain("no alcohol");
  });
  it("empty text → nothing", () => {
    expect(deterministicTags("", vocab)).toEqual({ interests: [], avoid_flags: [] });
  });
});

describe("finalize (validation)", () => {
  it("drops labels not in the vocabulary (hallucinations) and dedupes", () => {
    const out = finalize([
      { interests: ["coffee", "coffee", "space travel", "wizardry"], avoid_flags: ["no alcohol", "made up flag"] },
    ], vocab);
    expect(out.interests).toEqual(["coffee"]);
    expect(out.avoid_flags).toEqual(["no alcohol"]);
  });
  it("caps interests at 5 and avoid flags at 3", () => {
    const out = finalize([{ interests: vocab.interestLabels, avoid_flags: vocab.avoidLabels }], vocab);
    expect(out.interests.length).toBeLessThanOrEqual(5);
    expect(out.avoid_flags.length).toBeLessThanOrEqual(3);
  });
});
