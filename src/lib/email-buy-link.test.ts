import { describe, it, expect } from "vitest";
import { emailBuyLink } from "./email-buy-link";

const gift = (o: Record<string, unknown>) => ({
  id: "g1", name: "Gift", description: "", image_url: "", price_min: 30, price_max: 30,
  affiliate_url: "https://www.awin1.com/cread.php?x=1", affiliate_network: "awin", ...o,
});

describe("emailBuyLink", () => {
  it("non-Amazon pick → tracked redirect straight to the shop", () => {
    const l = emailBuyLink({ gift: gift({}), suggestionId: "abc" }, "sess");
    expect(l.href).toMatch(/\/go\/s\/abc$/);
    expect(l.label).toMatch(/Buy/);
  });
  it("Amazon pick → results page (no affiliate links in email)", () => {
    const l = emailBuyLink({ gift: gift({ affiliate_network: "amazon", affiliate_url: "https://www.amazon.com/dp/B0X?tag=x-20" }), suggestionId: "abc" }, "sess");
    expect(l.href).toMatch(/\/results\/sess$/);
  });
  it("no saved suggestion id → results page", () => {
    expect(emailBuyLink({ gift: gift({}) }, "sess").href).toMatch(/\/results\/sess$/);
  });
});
