import { describe, it, expect } from "vitest";
import { isMerchantExcluded, merchantsHiddenEverywhere, MERCHANT_EXCLUSIONS } from "./merchant-exclusions";

describe("isMerchantExcluded", () => {
  it("excludes PawFurEver for baby shower", () => {
    expect(isMerchantExcluded("PawFurEver", { occasion: "baby shower" })).toBe(true);
    expect(isMerchantExcluded("PawFurEver", { occasion: "Baby Shower" })).toBe(true); // case-insensitive
  });
  it("keeps PawFurEver for other occasions", () => {
    expect(isMerchantExcluded("PawFurEver", { occasion: "birthday" })).toBe(false);
  });
  it("hides Printerval from every quiz", () => {
    expect(isMerchantExcluded("Printerval", { occasion: "birthday", interests: ["fashion & accessories"] })).toBe(true);
    expect(isMerchantExcluded("Printerval", {})).toBe(true);
    expect(merchantsHiddenEverywhere()).toEqual(["Printerval"]);
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
