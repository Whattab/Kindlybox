import { describe, it, expect } from "vitest";
import { EMPTY_STATE, type V2State } from "./graph";
import { prefillFromParams, toQuizAnswers } from "./map";

const st = (o: Partial<V2State>): V2State => ({ ...EMPTY_STATE, ...o });

describe("toQuizAnswers", () => {
  it("maps relationship + gender to the catalogue's recipient/gender", () => {
    expect(toQuizAnswers(st({ relationship: "mom" }))).toMatchObject({ recipient: "parent", gender: "female" });
    expect(toQuizAnswers(st({ relationship: "dad" }))).toMatchObject({ recipient: "parent", gender: "male" });
    expect(toQuizAnswers(st({ relationship: "partner", gender: "him" }))).toMatchObject({ recipient: "him", gender: "male" });
    expect(toQuizAnswers(st({ relationship: "partner", gender: "either" }))).toMatchObject({ recipient: "", gender: "unknown" });
    expect(toQuizAnswers(st({ relationship: "coworker" }))).toMatchObject({ recipient: "co-worker", gender: "unknown" });
  });
  it("maps life stage to age group", () => {
    expect(toQuizAnswers(st({ relationship: "child", lifeStage: "toddler" })).ageGroup).toBe("under12");
    expect(toQuizAnswers(st({ relationship: "child", lifeStage: "teen" })).ageGroup).toBe("13-19");
    expect(toQuizAnswers(st({ relationship: "friend", lifeStage: "50s-60s" })).ageGroup).toBe("50s-60s");
    expect(toQuizAnswers(st({ relationship: "friend" })).ageGroup).toBe("");
  });
  it("maps occasions to catalogue labels", () => {
    expect(toQuizAnswers(st({ relationship: "friend", occasion: "new baby" })).occasion).toBe("baby shower");
    expect(toQuizAnswers(st({ relationship: "friend", occasion: "housewarming" })).occasion).toBe("house warming");
    expect(toQuizAnswers(st({ relationship: "friend", occasion: "retirement" })).occasion).toBe("promotion/retirement");
    expect(toQuizAnswers(st({ relationship: "friend", occasion: "birthday" })).occasion).toBe("birthday");
  });
  it("puts depth interests first, then the branch roots, capped at 5", () => {
    const a = toQuizAnswers(st({ saturday: ["kitchen", "outdoors"], depth: ["coffee", "fishing"] }));
    expect(a.interests).toEqual(["coffee", "fishing", "home & kitchen", "outdoor/ adventure"]);
    const many = toQuizAnswers(st({ saturday: ["relaxing", "hosting"] }));
    expect(many.interests.length).toBeLessThanOrEqual(5);
  });
  it("child adds no-alcohol and excludes intimate + luxe; coworker excludes intimate", () => {
    const kid = toQuizAnswers(st({ relationship: "child", lifeStage: "kid" }));
    expect(kid.avoidFlags).toContain("no alcohol");
    expect(kid.excludeIntimate).toBe(true);
    expect(kid.excludeLuxe).toBe(true);
    const cw = toQuizAnswers(st({ relationship: "coworker" }));
    expect(cw.excludeIntimate).toBe(true);
    expect(cw.excludeLuxe).toBeUndefined();
    expect(toQuizAnswers(st({ relationship: "partner" })).excludeIntimate).toBeUndefined();
  });
  it("passes gift feel (except 'surprise') and experience level", () => {
    expect(toQuizAnswers(st({ feel: "treat" })).giftFeel).toBe("treat");
    expect(toQuizAnswers(st({ feel: "surprise" })).giftFeel).toBeUndefined();
    expect(toQuizAnswers(st({ saturday: ["outdoors"], level: "expert" })).experienceLevel).toBe("expert");
  });
  it("sympathy ignores stale hobby answers", () => {
    const a = toQuizAnswers(st({ relationship: "friend", occasion: "sympathy", saturday: ["kitchen"], depth: ["coffee"] }));
    expect(a.interests).toEqual([]);
  });
});

describe("prefillFromParams", () => {
  it("understands reminder-email values v1 ignored", () => {
    const s = prefillFromParams({ recipient: "partner", occasion: "anniversary", budget: "50-100" });
    expect(s).toMatchObject({ relationship: "partner", occasion: "anniversary", budget: "50-100" });
    expect(prefillFromParams({ recipient: "colleague", occasion: "christmas" })).toMatchObject({ relationship: "coworker", occasion: "holidays" });
    expect(prefillFromParams({ recipient: "friend", occasion: "new baby" }).occasion).toBe("new baby");
    expect(prefillFromParams({ recipient: "friend", occasion: "housewarming" }).occasion).toBe("housewarming");
  });
  it("still accepts v1 values", () => {
    const s = prefillFromParams({ recipient: "him", occasion: "baby shower", ageGroup: "30s", interests: "gaming,home & kitchen,travel" });
    expect(s).toMatchObject({ relationship: "someone else", gender: "him", occasion: "new baby", lifeStage: "30s-40s" });
    expect(s.saturday).toEqual(["gadgets", "kitchen"]);
  });
  it("drops what it can't map instead of guessing", () => {
    const s = prefillFromParams({ recipient: "parent", occasion: "other", budget: "999" });
    expect(s).toMatchObject({ relationship: "", occasion: "", budget: "" });
  });
  it("drops an occasion the relationship doesn't allow", () => {
    expect(prefillFromParams({ recipient: "friend", occasion: "anniversary" }).occasion).toBe("");
  });
});
