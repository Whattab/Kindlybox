import { describe, it, expect } from "vitest";
import { computeStatus } from "./upsert-products";
import type { NormalizedProduct } from "./types";

// Only title + merchant_name matter to computeStatus.
const p = (title: string, merchant: string | null): NormalizedProduct =>
  ({ title, merchant_name: merchant } as NormalizedProduct);

describe("computeStatus", () => {
  it("trusted merchant + clean → approved", () => {
    expect(computeStatus(p("Ceramic Pour-Over Coffee Set", "Printerval"))).toBe("approved");
  });
  it("new/untrusted merchant + clean → staged", () => {
    expect(computeStatus(p("Ceramic Pour-Over Coffee Set", "Brand New Dropshipper"))).toBe("staged");
    expect(computeStatus(p("Nice Gift", null))).toBe("staged");
  });
  it("hard-blocked title → rejected on any merchant", () => {
    expect(computeStatus(p("Nazi Flag", "Printerval"))).toBe("rejected");
    expect(computeStatus(p("CBD Gummies", "Watches Of USA"))).toBe("rejected");
  });
  it("review-flagged title → staged (even on a trusted merchant)", () => {
    expect(computeStatus(p("Trump 2024 Hoodie", "Printerval"))).toBe("staged");
  });
  it("trademark: approved on a trusted authorized retailer, rejected on an untrusted one", () => {
    expect(computeStatus(p("Gucci G-Timeless Watch", "Watches Of USA"))).toBe("approved");
    expect(computeStatus(p("Gucci G-Timeless Watch", "Knockoff Store"))).toBe("rejected");
    expect(computeStatus(p("Lego eGift Card", "Giftcards.com"))).toBe("approved");
  });
});
