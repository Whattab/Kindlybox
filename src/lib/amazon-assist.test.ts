import { describe, it, expect } from "vitest";
import { avoidFlagsFromName, mergeBackfill, onlyAllowed, withParents } from "./amazon-assist";

describe("importer validation helpers", () => {
  it("keeps only allowed values, deduped", () => {
    expect(onlyAllowed(["coffee", "made-up", "coffee", 7], ["coffee", "tea"])).toEqual(["coffee"]);
    expect(onlyAllowed("coffee", ["coffee"])).toEqual([]);
  });
  it("adds the broad interest for each sub-hobby", () => {
    const parentOf = { coffee: "home & kitchen", fishing: "outdoor/ adventure" };
    expect(withParents(["coffee"], parentOf)).toEqual(["coffee", "home & kitchen"]);
    expect(withParents(["home & kitchen", "coffee"], parentOf)).toEqual(["home & kitchen", "coffee"]);
    expect(withParents(["gaming"], parentOf)).toEqual(["gaming"]);
  });
});

describe("avoidFlagsFromName", () => {
  it("flags scented and alcohol items by name", () => {
    expect(avoidFlagsFromName("Yankee Candle In Loving Memory")).toEqual(["scent-sensitive"]);
    expect(avoidFlagsFromName("Stemless Wine Glasses Set")).toEqual(["no alcohol"]);
    expect(avoidFlagsFromName("OXO Coffee Grinder")).toEqual([]);
    expect(avoidFlagsFromName("Ginger Tea Sampler")).toEqual([]); // "gin" only as a whole word
  });
});

describe("mergeBackfill (never removes, never adds new interest areas)", () => {
  const parentOf = { coffee: "home & kitchen", fishing: "outdoor/ adventure" };
  const ai = { interests: ["coffee", "fishing", "pets"], style: ["practical"], gift_type: ["physical"], avoid_flags: ["no alcohol"], occasions: ["birthday"], recipients: [], primary_interest: "coffee" };
  it("fills empty fields and refines existing interests only", () => {
    const out = mergeBackfill({ tags: ["home & kitchen"], style: [], gift_type: [], avoid_flags: [], occasions: [], primary_interest: null }, ai, parentOf, ["scent-sensitive"]);
    expect(out.tags).toEqual(["home & kitchen", "coffee"]); // no fishing, no pets
    expect(out.style).toEqual(["practical"]);
    expect(out.gift_type).toEqual(["physical"]);
    expect(out.avoid_flags).toEqual(["no alcohol", "scent-sensitive"]);
    expect(out.occasions).toEqual(["birthday"]);
    expect(out.primary_interest).toBe("coffee");
  });
  it("keeps the owner's existing choices", () => {
    const out = mergeBackfill({ tags: ["gaming"], style: ["fun & quirky"], gift_type: ["digital"], avoid_flags: [], occasions: ["graduation"], primary_interest: "gaming" }, ai, parentOf, []);
    expect(out).toMatchObject({ tags: ["gaming"], style: ["fun & quirky"], gift_type: ["digital"], occasions: ["graduation"], primary_interest: "gaming" });
  });
});
