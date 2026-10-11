import { describe, it, expect } from "vitest";
import { getRecommendations, type Gift, type QuizAnswers } from "./recommend";

let seq = 0;
const g = (o: Partial<Gift>): Gift => ({
  id: `g${seq++}`, name: "Item", description: "", image_url: "",
  price_min: 30, price_max: 30, tags: [], occasions: [], recipients: [], gender: "unisex",
  slug: null, destination_url: "https://x.com", affiliate_url: "https://x.com", affiliate_network: "amazon", active: true,
  ...o,
});
const base: QuizAnswers = { recipient: "", occasion: "birthday", interests: [], budget: "no-limit", ageGroup: "", gender: "unknown" };
const names = (r: ReturnType<typeof getRecommendations>) => r.map((x) => x.gift.name);

describe("occasion weighting", () => {
  it("specific occasion (baby shower) beats a lone interest match", () => {
    const baby = g({ name: "Baby Bouquet", occasions: ["baby shower"] });
    const hoodie = g({ name: "Adult Hoodie", tags: ["fashion & accessories"] });
    const recs = getRecommendations({ ...base, occasion: "baby shower", interests: ["fashion & accessories"] }, [baby, hoodie], { seed: 1, limit: 2 });
    expect(recs[0].gift.name).toBe("Baby Bouquet");
  });
  it("generic occasion (birthday) still lets interest lead", () => {
    const bdayOnly = g({ name: "Generic Birthday Thing", occasions: ["birthday"] });
    const hoodie = g({ name: "Hoodie", tags: ["fashion & accessories"], occasions: [] });
    const recs = getRecommendations({ ...base, occasion: "birthday", interests: ["fashion & accessories"] }, [bdayOnly, hoodie], { seed: 1, limit: 2 });
    expect(recs[0].gift.name).toBe("Hoodie");
  });
});

describe("avoid-flags filter", () => {
  const wine = g({ name: "Wine Set", tags: ["home & kitchen"], avoid_flags: ["no alcohol"] });
  const mug = g({ name: "Coffee Mug", tags: ["home & kitchen"] });
  const ans: QuizAnswers = { ...base, interests: ["home & kitchen"] };
  it("keeps the wine gift when there's no avoid flag", () => {
    expect(names(getRecommendations(ans, [wine, mug], { seed: 1, limit: 2 }))).toContain("Wine Set");
  });
  it("drops the wine gift when the shopper says no alcohol", () => {
    const out = names(getRecommendations({ ...ans, avoidFlags: ["no alcohol"] }, [wine, mug], { seed: 1, limit: 2 }));
    expect(out).not.toContain("Wine Set");
    expect(out).toContain("Coffee Mug");
  });
});
