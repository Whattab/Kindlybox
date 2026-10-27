import { describe, it, expect } from "vitest";
import {
  EMPTY_STATE, GATED_OCCASION_IDS, depthOptions, feelOptions, genderShown, levelShown, lifeStageOptions, occasionOptions,
  pruneState, visibleScreens, SCREENS, type V2State,
} from "./graph";

const st = (o: Partial<V2State>): V2State => ({ ...EMPTY_STATE, ...o });
const ids = (opts: { id: string }[]) => opts.map((o) => o.id);
const screenIds = (s: V2State, ctx = {}) => visibleScreens(s, ctx).map((x) => x.id);
const valid = (id: string, s: V2State) => SCREENS.find((x) => x.id === id)!.valid(s, {});

describe("S1 — who + life stage", () => {
  it("child gets child stages; adults get adult stages; grandparent only older ones", () => {
    expect(ids(lifeStageOptions(st({ relationship: "child" })))).toEqual(["baby", "toddler", "kid", "tween", "teen"]);
    expect(ids(lifeStageOptions(st({ relationship: "friend" })))).toEqual(["20s", "30s-40s", "50s-60s", "70+"]);
    expect(ids(lifeStageOptions(st({ relationship: "grandparent" })))).toEqual(["50s-60s", "70+"]);
  });
  it("life stage is required for a child, optional for adults", () => {
    expect(valid("who", st({ relationship: "child" }))).toBe(false);
    expect(valid("who", st({ relationship: "child", lifeStage: "teen" }))).toBe(true);
    expect(valid("who", st({ relationship: "friend" }))).toBe(true);
  });
  it("gender chip is hidden for mom and dad only", () => {
    expect(genderShown(st({ relationship: "mom" }))).toBe(false);
    expect(genderShown(st({ relationship: "dad" }))).toBe(false);
    expect(genderShown(st({ relationship: "partner" }))).toBe(true);
  });
});

describe("S2 — occasion depends on S1", () => {
  it("anniversary / Valentine's only for a partner", () => {
    expect(ids(occasionOptions(st({ relationship: "partner" })))).toContain("anniversary");
    expect(ids(occasionOptions(st({ relationship: "friend" })))).not.toContain("anniversary");
    expect(ids(occasionOptions(st({ relationship: "friend" })))).not.toContain("valentine's day");
  });
  it("graduation only for a child, teen or 20s", () => {
    expect(ids(occasionOptions(st({ relationship: "child", lifeStage: "kid" })))).toContain("graduation");
    expect(ids(occasionOptions(st({ relationship: "friend", lifeStage: "20s" })))).toContain("graduation");
    expect(ids(occasionOptions(st({ relationship: "friend", lifeStage: "50s-60s" })))).not.toContain("graduation");
  });
  it("Mother's / Father's Day only for mom / dad; no retirement for a child", () => {
    expect(ids(occasionOptions(st({ relationship: "mom" })))).toContain("mother's day");
    expect(ids(occasionOptions(st({ relationship: "dad" })))).not.toContain("mother's day");
    expect(ids(occasionOptions(st({ relationship: "child" })))).not.toContain("retirement");
  });
});

describe("screen visibility", () => {
  it("a typical path shows every screen", () => {
    expect(screenIds(st({ relationship: "mom", occasion: "birthday", saturday: ["kitchen"] })))
      .toEqual(["who", "occasion", "saturday", "depth", "feel", "budget", "note"]);
  });
  it("sympathy skips the hobby questions and never offers 'fun'", () => {
    const s = st({ relationship: "friend", occasion: "sympathy" });
    expect(screenIds(s)).toEqual(["who", "occasion", "feel", "budget", "note"]);
    expect(ids(feelOptions(s))).not.toContain("fun");
  });
  it("depth screen hidden for branches with no depth and no level question", () => {
    expect(screenIds(st({ occasion: "birthday", saturday: ["reading", "traveling"] }))).not.toContain("depth");
  });
  it("depth options respect product availability (10+ rule)", () => {
    const s = st({ saturday: ["kitchen"] });
    expect(ids(depthOptions(s, { depthAvailable: new Set(["coffee", "baking"]) }))).toEqual(["baking", "coffee"]);
  });
  it("level question only for hobby branches", () => {
    expect(levelShown(st({ saturday: ["outdoors"] }))).toBe(true);
    expect(levelShown(st({ saturday: ["reading"] }))).toBe(false);
  });
  it("no wine depth option for a child", () => {
    expect(ids(depthOptions(st({ relationship: "child", saturday: ["kitchen"] })))).not.toContain("wine & cocktails");
  });
});

describe("pruneState", () => {
  it("drops answers no longer offered after an earlier answer changes", () => {
    const s = pruneState(st({ relationship: "friend", occasion: "anniversary", gender: "her" }));
    expect(s.occasion).toBe("");
    expect(s.gender).toBe("her");
    expect(pruneState(st({ relationship: "mom", gender: "him" })).gender).toBe("");
  });
  it("switching to sympathy clears hobbies, depth and level", () => {
    const s = pruneState(st({ occasion: "sympathy", saturday: ["kitchen"], depth: ["coffee"], level: "expert", feel: "fun" }));
    expect(s.saturday).toEqual([]);
    expect(s.depth).toEqual([]);
    expect(s.level).toBe("");
    expect(s.feel).toBe("");
  });
  it("drops depth whose branch was deselected", () => {
    expect(pruneState(st({ saturday: ["outdoors"], depth: ["coffee", "fishing"] })).depth).toEqual(["fishing"]);
  });
});

describe("newer occasions (2026-10-27)", () => {
  const ids = (s: Partial<V2State>, avail?: string[]) =>
    occasionOptions({ ...EMPTY_STATE, ...s } as V2State, avail ? { occasionsAvailable: new Set(avail) } : {}).map((o) => o.id);

  it("stay hidden until they have enough gifts", () => {
    const shown = ids({ relationship: "friend", lifeStage: "20s" }, []);
    for (const id of GATED_OCCASION_IDS) expect(shown).not.toContain(id);
  });
  it("appear once stocked, and 'Just because' stays last", () => {
    const shown = ids({ relationship: "friend", lifeStage: "20s" }, GATED_OCCASION_IDS);
    expect(shown).toEqual(expect.arrayContaining(["get well soon", "bridal shower", "galentine's day", "farewell", "hostess gift"]));
    expect(shown[shown.length - 1]).toBe("just because");
  });
  it("only where they make sense", () => {
    const kid = ids({ relationship: "child", lifeStage: "kid" }, GATED_OCCASION_IDS);
    expect(kid).toContain("get well soon");
    expect(kid).not.toContain("bridal shower");
    expect(kid).not.toContain("bachelor party");
    const partner = ids({ relationship: "partner" }, GATED_OCCASION_IDS);
    expect(partner).toContain("engagement");
    expect(partner).not.toContain("galentine's day");
    expect(partner).not.toContain("hostess gift");
  });
  it("labels Holidays as Christmas & holidays, and the old 'New baby' button as Baby shower", () => {
    const opts = occasionOptions({ ...EMPTY_STATE, relationship: "friend" } as V2State, { occasionsAvailable: new Set(GATED_OCCASION_IDS) });
    expect(opts.find((o) => o.id === "holidays")?.label).toBe("Christmas & holidays");
    expect(opts.find((o) => o.id === "new baby")?.label).toBe("Baby shower");
    expect(opts.find((o) => o.id === "newborn")?.label).toBe("New baby");
  });
});
