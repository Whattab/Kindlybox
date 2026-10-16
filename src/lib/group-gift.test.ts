import { describe, it, expect } from "vitest";
import {
  cleanName, venmoHandle, paypalHandle, cashappHandle, payLinks,
  parseAmount, splitShare, tallyVotes, sameKey,
} from "./group-gift";

describe("handles", () => {
  it("accepts the usual spellings", () => {
    expect(venmoHandle("@Jane-Doe")).toBe("Jane-Doe");
    expect(venmoHandle("https://venmo.com/u/jane_d")).toBe("jane_d");
    expect(paypalHandle("paypal.me/JaneDoe")).toBeNull(); // needs https:// or bare
    expect(paypalHandle("https://paypal.me/JaneDoe")).toBe("JaneDoe");
    expect(paypalHandle("JaneDoe")).toBe("JaneDoe");
    expect(cashappHandle("$jane")).toBe("jane");
    expect(cashappHandle("https://cash.app/$jane")).toBe("jane");
  });
  it("rejects anything that could break out of the link", () => {
    expect(venmoHandle("jane/../../evil")).toBeNull();
    expect(paypalHandle("jane?x=1")).toBeNull();
    expect(cashappHandle("javascript:alert(1)")).toBeNull();
    expect(venmoHandle("")).toBeNull();
  });
});

describe("payLinks", () => {
  it("builds links with the share pre-filled where supported", () => {
    const links = payLinks({ pay_venmo: "jane", pay_paypal: "JaneDoe", pay_cashapp: "jane" }, 22.5);
    expect(links.map((l) => l.href)).toEqual([
      "https://venmo.com/u/jane",
      "https://paypal.me/JaneDoe/22.50USD",
      "https://cash.app/$jane/22.50",
    ]);
  });
  it("skips missing or invalid handles", () => {
    expect(payLinks({ pay_venmo: "bad handle!", pay_paypal: null }, null)).toEqual([]);
  });
});

describe("amounts", () => {
  it("parses typed totals", () => {
    expect(parseAmount("$89.99")).toBe(89.99);
    expect(parseAmount("1,200")).toBe(1200);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("rounds each share up so the organiser is never short", () => {
    expect(splitShare(100, 3)).toBe(33.34);
    expect(splitShare(90, 4)).toBe(22.5);
    expect(splitShare(null, 3)).toBeNull();
    expect(splitShare(50, 0)).toBeNull();
  });
});

describe("misc", () => {
  it("cleans names", () => {
    expect(cleanName("  Jane   Doe  ")).toBe("Jane Doe");
    expect(cleanName("x".repeat(60)).length).toBe(40);
  });
  it("tallies votes", () => {
    expect(tallyVotes([{ vote_suggestion_id: "a" }, { vote_suggestion_id: "a" }, { vote_suggestion_id: null }, { vote_suggestion_id: "b" }]))
      .toEqual({ a: 2, b: 1 });
  });
  it("compares keys", () => {
    expect(sameKey("abc", "abc")).toBe(true);
    expect(sameKey("abc", "abd")).toBe(false);
    expect(sameKey(null, "abc")).toBe(false);
  });
});
