import { describe, it, expect } from "vitest";
import { getRecommendations, styleOf, type Gift, type QuizAnswers } from "./recommend";

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

describe("result diversity (5b)", () => {
  it("varies the feel across the trio when options tie", () => {
    const pool = [
      g({ name: "Practical A", tags: ["home & kitchen"], style: ["practical"] }),
      g({ name: "Practical B", tags: ["home & kitchen"], style: ["practical"] }),
      g({ name: "Sentimental C", tags: ["home & kitchen"], style: ["sentimental"] }),
      g({ name: "Experience D", tags: ["home & kitchen"], style: ["experience"] }),
    ];
    const out = names(getRecommendations({ ...base, interests: ["home & kitchen"] }, pool, { seed: 1, limit: 3 }));
    expect(out).toContain("Sentimental C");
    expect(out).toContain("Experience D"); // the two distinct feels surface over a 2nd practical
  });

  it("does not dilute a focused interest with off-interest variety", () => {
    const pool = [
      g({ name: "Coffee Grinder", tags: ["home & kitchen", "coffee"], style: ["practical"] }),
      g({ name: "Coffee Scale", tags: ["home & kitchen", "coffee"], style: ["practical"] }),
      g({ name: "Pour Over", tags: ["home & kitchen", "coffee"], style: ["practical"] }),
      g({ name: "Sentimental Trinket", tags: ["home & kitchen"], style: ["sentimental"] }),
    ];
    const out = names(getRecommendations({ ...base, interests: ["home & kitchen", "coffee"] }, pool, { seed: 1, limit: 3 }));
    expect(out).not.toContain("Sentimental Trinket"); // coffee (2 interest hits) outscores the window
  });

  it("excludes fun/quirky items for a sympathy occasion", () => {
    const flowers = g({ name: "Peaceful Lily Plant", tags: ["home decor"], occasions: ["sympathy"], style: ["sentimental"] });
    const funny = g({ name: "Gag Novelty Mug", tags: ["home decor"], occasions: ["sympathy"], style: ["fun & quirky"] });
    const out = names(getRecommendations({ ...base, occasion: "sympathy", interests: [] }, [flowers, funny], { seed: 1, limit: 2 }));
    expect(out).not.toContain("Gag Novelty Mug");
    expect(out).toContain("Peaceful Lily Plant");
  });
});

describe("styleOf fallback (products carry no style tag yet)", () => {
  it("derives 'treat' for a flowers product", () => {
    expect(styleOf(g({ name: "Sweet Beginnings Bouquet" }))).toBe("treat");
  });
  it("derives 'sentimental' for a personalized product", () => {
    expect(styleOf(g({ name: "Monogram Name Wood Sign" }))).toBe("sentimental");
  });
  it("defaults to 'practical'", () => {
    expect(styleOf(g({ name: "Stainless Steel Water Bottle" }))).toBe("practical");
  });
  it("prefers a real style tag over derivation", () => {
    expect(styleOf(g({ name: "Funny Bouquet", style: ["practical"] }))).toBe("practical");
  });
});
