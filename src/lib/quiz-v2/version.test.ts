import { describe, it, expect } from "vitest";
import { chooseQuizVersion } from "./version";

describe("chooseQuizVersion", () => {
  it("defaults to v1 when the percentage is unset or 0", () => {
    expect(chooseQuizVersion({})).toEqual({ version: "v1", remember: false });
    expect(chooseQuizVersion({ percent: "0", random: () => 0 })).toEqual({ version: "v1", remember: false });
  });
  it("URL override wins over cookie and percentage, and is remembered", () => {
    expect(chooseQuizVersion({ override: "v2", cookie: "v1", percent: "0" })).toEqual({ version: "v2", remember: true });
    expect(chooseQuizVersion({ override: "v1", cookie: "v2", percent: "100" })).toEqual({ version: "v1", remember: true });
  });
  it("a remembered cookie is kept", () => {
    expect(chooseQuizVersion({ cookie: "v2", percent: "0" })).toEqual({ version: "v2", remember: false });
  });
  it("new visitors are split by percentage", () => {
    expect(chooseQuizVersion({ percent: "100", random: () => 0.99 }).version).toBe("v2");
    expect(chooseQuizVersion({ percent: "30", random: () => 0.29 }).version).toBe("v2");
    expect(chooseQuizVersion({ percent: "30", random: () => 0.31 }).version).toBe("v1");
  });
  it("ignores junk values", () => {
    expect(chooseQuizVersion({ override: "v9", cookie: "x", percent: "abc" }).version).toBe("v1");
  });
  it("kill switch forces v1 for everyone", () => {
    expect(chooseQuizVersion({ killSwitch: "1", override: "v2", cookie: "v2", percent: "100" })).toEqual({ version: "v1", remember: false });
  });
});
