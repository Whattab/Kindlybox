import { describe, it, expect } from "vitest";
import { isTrustedMerchant } from "./trusted-merchants";

describe("isTrustedMerchant", () => {
  it("accepts an allowlisted merchant (exact name)", () => {
    expect(isTrustedMerchant("Printerval")).toBe(true);
    expect(isTrustedMerchant("BBBGEM")).toBe(true);
    expect(isTrustedMerchant("Flowers Fast.com-Send Flowers Same Day Delivery")).toBe(true);
  });

  it("rejects an unknown merchant", () => {
    expect(isTrustedMerchant("Sketchy Dropship Store")).toBe(false);
    expect(isTrustedMerchant("printerval")).toBe(false); // case-sensitive: exact match only
  });

  it("rejects empty/null", () => {
    expect(isTrustedMerchant(null)).toBe(false);
    expect(isTrustedMerchant(undefined)).toBe(false);
    expect(isTrustedMerchant("")).toBe(false);
  });
});
