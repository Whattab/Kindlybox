import { describe, it, expect } from "vitest";
import { isHardBlocked, isReviewFlagged, isTrademarkBlocked, isBlockedTitle } from "./blocklist";

describe("isHardBlocked (→ rejected)", () => {
  it("blocks explicit/hate/restricted", () => {
    expect(isHardBlocked("Hardcore Porn DVD")).toBe(true);
    expect(isHardBlocked("Nazi Swastika Flag")).toBe(true);
    expect(isHardBlocked("CBD Gummies 500mg")).toBe(true);
  });
  it("blocks medical claim phrases and claim+condition", () => {
    expect(isHardBlocked("Clinically Proven Weight Loss Tea")).toBe(true);
    expect(isHardBlocked("Bracelet that Cures Anxiety")).toBe(true);
    expect(isHardBlocked("Patch that Treats Arthritis Pain")).toBe(true);
  });
  it("does NOT block bare treats/heals or wellness product types", () => {
    expect(isHardBlocked("Organic Dog Treats")).toBe(false);
    expect(isHardBlocked("Hope Heals Luxury Bouquet")).toBe(false);
    expect(isHardBlocked("Shiatsu Neck Massager")).toBe(false);
    expect(isHardBlocked("Electric Heating Pad")).toBe(false);
    expect(isHardBlocked("Essential Oil Diffuser")).toBe(false);
  });
});

describe("isReviewFlagged (→ staged)", () => {
  it("flags mild profanity, partisan political, rec drugs", () => {
    expect(isReviewFlagged("Funny Fuck Off Mug")).toBe(true);
    expect(isReviewFlagged("Trump 2024 Hat")).toBe(true);
    expect(isReviewFlagged("Joe Biden Funny Tee")).toBe(true);
    expect(isReviewFlagged("Weed Leaf Rolling Tray")).toBe(true);
  });
  it("does NOT flag patriotic/general words", () => {
    expect(isReviewFlagged("Freedom America Patriot Flag")).toBe(false);
    expect(isReviewFlagged("Vote USA 4th of July Tee")).toBe(false);
    expect(isReviewFlagged("Veteran Support Our Troops Mug")).toBe(false);
  });
  it("does NOT flag 'Harris Tweed' (bare harris removed)", () => {
    expect(isReviewFlagged("Harris Tweed Wool Blazer")).toBe(false);
  });
});

describe("isTrademarkBlocked + merchant-aware isBlockedTitle", () => {
  it("detects trademark names", () => {
    expect(isTrademarkBlocked("Gucci G-Timeless Watch")).toBe(true);
    expect(isTrademarkBlocked("Disney Mickey Mouse Plush")).toBe(true);
  });
  it("trademark is blocked on untrusted/unknown merchants only", () => {
    expect(isBlockedTitle("Gucci G-Timeless Watch", "Sketchy Dropship")).toBe(true);
    expect(isBlockedTitle("Gucci G-Timeless Watch", "Watches Of USA")).toBe(false); // trusted retailer
    expect(isBlockedTitle("Lego eGift Card", "Giftcards.com")).toBe(false); // trusted — official gift cards
  });
  it("hard/review flagged regardless of merchant", () => {
    expect(isBlockedTitle("Nazi Flag", "Watches Of USA")).toBe(true);     // hard
    expect(isBlockedTitle("Trump 2024 Hat", "Printerval")).toBe(true);    // review
  });
  it("clean titles pass for any merchant", () => {
    expect(isBlockedTitle("Ceramic Pour-Over Coffee Set", "Printerval")).toBe(false);
    expect(isBlockedTitle("XXX Large Peace Lily", "Flowers Fast.com-Send Flowers Same Day Delivery")).toBe(false);
  });
});
