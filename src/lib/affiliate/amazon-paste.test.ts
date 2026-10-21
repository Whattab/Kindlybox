import { describe, it, expect } from "vitest";
import { amazonShortLink, isFollowableAmazonHost, nameFromAmazonUrl, parseAmazonPaste } from "./amazon-paste";

const SITESTRIPE = `<a href="https://www.amazon.com/dp/B07CSKGLMM?&amp;linkCode=li2&amp;tag=kindlybox0c-20&amp;linkId=abc&amp;language=en_US&amp;ref_=as_li_ss_il" target="_blank"><img border="0" src="//ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&amp;ASIN=B07CSKGLMM&amp;Format=_SL250_&amp;ID=AsinImage&amp;MarketPlace=US&amp;ServiceVersion=20070822&amp;WS=1&amp;tag=kindlybox0c-20&amp;language=en_US" ></a><img src="https://ir-na.amazon-adsystem.com/e/ir?t=kindlybox0c-20&amp;language=en_US&amp;l=li2&amp;o=1&amp;a=B07CSKGLMM" width="1" height="1" border="0" alt="" style="border:none !important; margin:0px !important;" />`;

describe("parseAmazonPaste", () => {
  it("reads a bare ASIN and a product URL", () => {
    expect(parseAmazonPaste("B07CSKGLMM")).toEqual({ asin: "B07CSKGLMM", imageUrl: null });
    expect(parseAmazonPaste("https://www.amazon.com/OXO-Grinder/dp/B07CSKGLMM/ref=sr_1_1")).toEqual({ asin: "B07CSKGLMM", imageUrl: null });
  });
  it("reads ASIN + official image from a SiteStripe snippet, skipping the tracking pixel", () => {
    const r = parseAmazonPaste(SITESTRIPE);
    expect(r.asin).toBe("B07CSKGLMM");
    expect(r.imageUrl).toMatch(/^https:\/\/ws-na\.amazon-adsystem\.com\/widgets\/q\?.*ASIN=B07CSKGLMM/);
    expect(r.imageUrl).toContain("&Format=_SL250_");
  });
  it("handles junk and empty input", () => {
    expect(parseAmazonPaste("")).toEqual({ asin: null, imageUrl: null });
    expect(parseAmazonPaste("hello")).toEqual({ asin: null, imageUrl: null });
  });
});

describe("Amazon short links", () => {
  it("recognises the short-link services", () => {
    expect(amazonShortLink("https://link.amazon/B0hvLlztp")).toBe("https://link.amazon/B0hvLlztp");
    expect(amazonShortLink("amzn.to/3abcXYZ")).toBe("https://amzn.to/3abcXYZ");
    expect(amazonShortLink("https://a.co/d/abc123")).toBe("https://a.co/d/abc123");
  });
  it("ignores everything else", () => {
    expect(amazonShortLink("https://evil.example/redirect")).toBeNull();
    expect(amazonShortLink("B07CSKGLMM")).toBeNull();
    expect(amazonShortLink("https://link.amazon/x and more text")).toBeNull();
    expect(amazonShortLink("")).toBeNull();
  });
  it("only follows hops to link services or Amazon sites", () => {
    expect(isFollowableAmazonHost("https://amzlinks.in/B0hvLlztp")).toBe(true);
    expect(isFollowableAmazonHost("https://www.amazon.com/dp/B003OSSKWK")).toBe(true);
    expect(isFollowableAmazonHost("https://smile.amazon.co.uk/x")).toBe(true);
    expect(isFollowableAmazonHost("https://amazon.com.evil.example/x")).toBe(false);
    expect(isFollowableAmazonHost("http://169.254.169.254/latest")).toBe(false);
  });
});

describe("name from an Amazon link", () => {
  it("reads the words before /dp/", () => {
    expect(nameFromAmazonUrl("https://www.amazon.com/Willow-Tree-hand-painted-sculpted-Remembrance/dp/B003OSSKWK/ref=sr_1_3?tag=x"))
      .toBe("Willow Tree Hand Painted Sculpted Remembrance");
  });
  it("returns null when the link has no product words", () => {
    expect(nameFromAmazonUrl("https://www.amazon.com/dp/B003OSSKWK")).toBeNull();
    expect(nameFromAmazonUrl("B003OSSKWK")).toBeNull();
    expect(nameFromAmazonUrl("https://link.amazon/B0hvLlztp")).toBeNull();
  });
});
