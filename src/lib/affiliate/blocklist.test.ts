import { describe, it, expect } from "vitest";
import { isBlockedTitle } from "./blocklist";

describe("isBlockedTitle", () => {
  it("blocks political terms", () => {
    expect(isBlockedTitle("Trump 2024 Campaign Mug")).toBe(true);
    expect(isBlockedTitle("MAGA hat")).toBe(true);
  });

  it("blocks offensive/adult terms", () => {
    expect(isBlockedTitle("Funny Fuck Off Doormat")).toBe(true);
    expect(isBlockedTitle("NSFW XXX Gag Gift")).toBe(true);
  });

  it("blocks medical-claim terms", () => {
    expect(isBlockedTitle("CBD Detox Patch")).toBe(true);
    expect(isBlockedTitle("Clinically Proven Weight Loss Tea")).toBe(true);
  });

  it("does not block sentimental product names that merely contain heal/cure", () => {
    expect(isBlockedTitle("Hope Heals Luxury Bouquet")).toBe(false);
    expect(isBlockedTitle("Time Heals Sympathy Flowers")).toBe(false);
  });

  it("blocks trademarked brands/characters", () => {
    expect(isBlockedTitle("Disney Mickey Mouse Plush")).toBe(true);
    expect(isBlockedTitle("Star Wars Baby Yoda Figure")).toBe(true);
    expect(isBlockedTitle("Louis Vuitton Style Wallet")).toBe(true);
  });

  it("allows clean titles", () => {
    expect(isBlockedTitle("Ceramic Pour-Over Coffee Set")).toBe(false);
    expect(isBlockedTitle("Organic Cotton Throw Blanket")).toBe(false);
  });

  it("does not over-block with whole-word matching", () => {
    expect(isBlockedTitle("Scranton City Map Print")).toBe(false); // not 'nba'
    expect(isBlockedTitle("Harris Tweed Blazer")).toBe(false);     // 'tweed' != 'weed'
    expect(isBlockedTitle("Organic Dog Treats")).toBe(false);      // 'treats' no longer bare-blocked
    expect(isBlockedTitle("Manicure Kit")).toBe(false);            // 'cure' is whole-word only
  });

  it("handles empty/null", () => {
    expect(isBlockedTitle(null)).toBe(false);
    expect(isBlockedTitle("")).toBe(false);
  });
});
