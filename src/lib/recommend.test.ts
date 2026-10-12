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

describe("Step 6 relationship rules + experience level", () => {
  const romantic = g({ name: "Romantic Couples Massage Kit", tags: ["fitness & wellness"] });
  const luxe = g({ name: "Silk Robe", tags: ["fitness & wellness"], style: ["luxe"] });
  const plain = g({ name: "Yoga Mat", tags: ["fitness & wellness"] });
  const ans: QuizAnswers = { ...base, interests: ["fitness & wellness"] };

  it("leaves results alone when the flags are unset (v1 unchanged)", () => {
    expect(names(getRecommendations(ans, [romantic, luxe, plain], { seed: 1, limit: 3 }))).toHaveLength(3);
  });
  it("excludeIntimate drops romantic items (child / coworker)", () => {
    const out = names(getRecommendations({ ...ans, excludeIntimate: true }, [romantic, luxe, plain], { seed: 1, limit: 3 }));
    expect(out).not.toContain("Romantic Couples Massage Kit");
    expect(out).toContain("Silk Robe");
  });
  it("excludeLuxe drops luxe-styled items (child)", () => {
    const out = names(getRecommendations({ ...ans, excludeLuxe: true }, [romantic, luxe, plain], { seed: 1, limit: 3 }));
    expect(out).not.toContain("Silk Robe");
  });
  it("'has all the gear' favours consumables / experiences over another starter item", () => {
    const starter = g({ name: "Beginner Fly Rod", tags: ["fishing"] });
    const flies = g({ name: "Premium Fly Assortment", tags: ["fishing"], gift_type: ["consumable"] });
    const recs = getRecommendations({ ...base, interests: ["fishing"], experienceLevel: "expert" }, [starter, flies], { seed: 1, limit: 2 });
    expect(recs[0].gift.name).toBe("Premium Fly Assortment");
  });
  it("new adult life-stage age groups filter mismatched milestone items", () => {
    const m40 = g({ name: "40th Birthday Mug", tags: ["home & kitchen"] });
    const m70 = g({ name: "70th Birthday Mug", tags: ["home & kitchen"] });
    const out = names(getRecommendations({ ...base, interests: ["home & kitchen"], ageGroup: "30s-40s" }, [m40, m70], { seed: 1, limit: 2 }));
    expect(out).toEqual(["40th Birthday Mug"]);
  });
});

describe("gift feel (Step 6 question)", () => {
  const ans: QuizAnswers = { ...base, interests: ["coffee", "home & kitchen"], giftFeel: "treat" };
  it("2 of 3 picks match the chosen feel when they're relevant", () => {
    const pool = [
      g({ name: "Coffee Grinder", tags: ["coffee", "home & kitchen"], style: ["practical"] }),
      g({ name: "Coffee Truffles", tags: ["coffee", "home & kitchen"], style: ["luxe"] }),
      g({ name: "Espresso Gift Box", tags: ["coffee", "home & kitchen"], style: ["luxe"] }),
      g({ name: "Coffee Scale", tags: ["coffee", "home & kitchen"], style: ["practical"] }),
    ];
    const recs = getRecommendations(ans, pool, { seed: 1, limit: 3 });
    expect(recs.filter((r) => styleOf(r.gift) === "treat")).toHaveLength(2);
  });
  it("never trades a whole interest tier for the feel", () => {
    const pool = [
      g({ name: "Coffee Grinder", tags: ["coffee", "home & kitchen"], style: ["practical"] }),
      g({ name: "Pour Over", tags: ["coffee", "home & kitchen"], style: ["practical"] }),
      g({ name: "Coffee Scale", tags: ["coffee", "home & kitchen"], style: ["practical"] }),
      g({ name: "Chocolate Bouquet", description: "a kitchen treat", style: ["luxe"] }), // partial match only
    ];
    expect(names(getRecommendations(ans, pool, { seed: 1, limit: 3 }))).not.toContain("Chocolate Bouquet");
  });
  it("treats 'Name - variant' rows as one gift", () => {
    const pool = [
      g({ name: "Lavender Bouquet - Standard", tags: ["coffee"] }),
      g({ name: "Lavender Bouquet - Deluxe", tags: ["coffee"] }),
      g({ name: "Coffee Mug", tags: ["coffee"] }),
    ];
    const out = names(getRecommendations({ ...base, interests: ["coffee"] }, pool, { seed: 1, limit: 3 }));
    expect(out.filter((n) => n.startsWith("Lavender"))).toHaveLength(1);
  });
});

describe("live-test fixes (2026-10-12)", () => {
  it("drops pet supplies unless the shopper picked pets", () => {
    const supp = g({ name: "Hip & Joint Supplement for Dogs", tags: ["fitness & wellness"] });
    const watch = g({ name: "Running Smartwatch", tags: ["fitness & wellness"] });
    const ans: QuizAnswers = { ...base, interests: ["fitness & wellness"] };
    expect(names(getRecommendations(ans, [supp, watch], { seed: 1, limit: 2 }))).toEqual(["Running Smartwatch"]);
    expect(names(getRecommendations({ ...ans, interests: ["fitness & wellness", "pets"] }, [supp, watch], { seed: 1, limit: 2 }))).toContain("Hip & Joint Supplement for Dogs");
  });
  it("drops adult-sized apparel for a young child but keeps kid-sized", () => {
    const tee = g({ name: "Rothco Tactical Athletic Fit 3d T-shirt", tags: ["pets"] });
    const hoodie = g({ name: "Kawaii Corgi Pullover Hoodie", tags: ["pets"] });
    const kidTee = g({ name: "Toddler Dinosaur T-shirt", tags: ["pets"] });
    const plush = g({ name: "Plush Puppy Toy", tags: ["pets"] });
    const out = names(getRecommendations({ ...base, interests: ["pets"], ageGroup: "under12" }, [tee, hoodie, kidTee, plush], { seed: 1, limit: 4 }));
    expect(out).not.toContain("Rothco Tactical Athletic Fit 3d T-shirt");
    expect(out).not.toContain("Kawaii Corgi Pullover Hoodie");
    expect(out).toEqual(expect.arrayContaining(["Toddler Dinosaur T-shirt", "Plush Puppy Toy"]));
  });
});

describe("child apparel uses the title, not boilerplate descriptions", () => {
  it("drops an adult hoodie whose description mentions kids", () => {
    const hoodie = g({ name: "Kawaii Corgi Pullover Hoodie", description: "Hoodie for unisex. Also great for kids!", tags: ["pets"] });
    const plush = g({ name: "Plush Puppy Toy", tags: ["pets"] });
    expect(names(getRecommendations({ ...base, interests: ["pets"], ageGroup: "under12" }, [hoodie, plush], { seed: 1, limit: 2 }))).toEqual(["Plush Puppy Toy"]);
  });
});
