import { describe, it, expect } from "vitest";
import { parseAmazonPaste } from "./amazon-paste";

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
