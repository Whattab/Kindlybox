import { describe, it, expect } from "vitest";
import { isAmazonItem, AMAZON_PRICE_PLACEHOLDER } from "./amazon-display";

describe("isAmazonItem", () => {
  it("detects Amazon by network tag (case-insensitive)", () => {
    expect(isAmazonItem({ affiliate_network: "amazon" })).toBe(true);
    expect(isAmazonItem({ affiliate_network: "AMAZON" })).toBe(true);
  });

  it("detects Amazon by URL host", () => {
    expect(isAmazonItem({ url: "https://www.amazon.com/dp/B07CSKGLMM?tag=kindlybox0c-20" })).toBe(true);
    expect(isAmazonItem({ affiliate_network: "other", url: "https://amazon.co.uk/dp/X" })).toBe(true);
  });

  it("is false for other networks", () => {
    expect(isAmazonItem({ affiliate_network: "awin" })).toBe(false);
    expect(isAmazonItem({ affiliate_network: "rakuten", url: "https://giftcards.com/x" })).toBe(false);
    expect(isAmazonItem({ affiliate_network: "other", url: "https://bookshop.org/a/129087/978" })).toBe(false);
    expect(isAmazonItem({})).toBe(false);
  });

  it("exposes the placeholder text", () => {
    expect(AMAZON_PRICE_PLACEHOLDER).toBe("See price on Amazon");
  });
});
