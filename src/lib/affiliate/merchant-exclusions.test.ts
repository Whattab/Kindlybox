import { describe, it, expect } from "vitest";
import { isMerchantExcluded, MERCHANT_EXCLUSIONS } from "./merchant-exclusions";

describe("isMerchantExcluded", () => {
  it("excludes Printerval for baby shower", () => {
    expect(isMerchantExcluded("Printerval", { occasion: "baby shower" })).toBe(true);
    expect(isMerchantExcluded("Printerval", { occasion: "Baby Shower" })).toBe(true); // case-insensitive
  });
  it("keeps Printerval for other occasions", () => {
    expect(isMerchantExcluded("Printerval", { occasion: "birthday" })).toBe(false);
  });
  it("never excludes a merchant with no rule", () => {
    expect(isMerchantExcluded("Flowers Fast", { occasion: "baby shower" })).toBe(false);
    expect(isMerchantExcluded(null, { occasion: "baby shower" })).toBe(false);
  });
  it("supports interest-based rules", () => {
    MERCHANT_EXCLUSIONS.__TestCo = { interests: ["gaming"] };
    expect(isMerchantExcluded("__TestCo", { interests: ["gaming", "coffee"] })).toBe(true);
    expect(isMerchantExcluded("__TestCo", { interests: ["coffee"] })).toBe(false);
    delete MERCHANT_EXCLUSIONS.__TestCo;
  });
});
