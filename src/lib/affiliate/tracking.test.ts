import { describe, it, expect } from "vitest";
import { appendTrackingParams, clickSubtag, AMAZON_ASSOCIATE_TAG, parseAsin, amazonProductUrl } from "./tracking";

const params = (url: string) => new URL(url).searchParams;

describe("clickSubtag", () => {
  it("prefixes the suggestion id", () => {
    expect(clickSubtag("abc-123")).toBe("kb-abc-123");
  });
});

describe("appendTrackingParams", () => {
  it("amazon: injects the associate tag when missing and adds ascsubtag", () => {
    const out = appendTrackingParams("https://www.amazon.com/dp/B0BBBG4QMF", "amazon", "kb-1");
    expect(params(out).get("tag")).toBe(AMAZON_ASSOCIATE_TAG);
    expect(params(out).get("ascsubtag")).toBe("kb-1");
  });

  it("amazon: preserves an existing tag, still adds ascsubtag", () => {
    const out = appendTrackingParams("https://www.amazon.com/dp/X?tag=someone-else-20", "amazon", "kb-2");
    expect(params(out).get("tag")).toBe("someone-else-20");
    expect(params(out).get("ascsubtag")).toBe("kb-2");
  });

  it("amazon: detected by URL even when network says 'other'", () => {
    const out = appendTrackingParams("https://www.amazon.com/dp/X", "other", "kb-3");
    expect(params(out).get("tag")).toBe(AMAZON_ASSOCIATE_TAG);
    expect(params(out).get("ascsubtag")).toBe("kb-3");
  });

  it("awin: adds clickref, preserves existing params", () => {
    const out = appendTrackingParams("https://www.awin1.com/pclick.php?p=1&a=2&m=3", "awin", "kb-4");
    expect(params(out).get("clickref")).toBe("kb-4");
    expect(params(out).get("p")).toBe("1");
    expect(params(out).get("m")).toBe("3");
  });

  it("cj: adds sid", () => {
    const out = appendTrackingParams("https://www.anrdoezrs.net/click-1-2?url=https%3A%2F%2Fx.com", "cj", "kb-5");
    expect(params(out).get("sid")).toBe("kb-5");
    expect(params(out).get("url")).toBe("https://x.com");
  });

  it("rakuten: adds u1", () => {
    const out = appendTrackingParams("https://click.linksynergy.com/link?id=A&offerid=B", "rakuten", "kb-6");
    expect(params(out).get("u1")).toBe("kb-6");
    expect(params(out).get("id")).toBe("A");
  });

  it("bookshop/other: unchanged", () => {
    const url = "https://bookshop.org/a/129087/9780593978177";
    expect(appendTrackingParams(url, "other", "kb-7")).toBe(url);
  });

  it("invalid/relative URL: returned unchanged", () => {
    expect(appendTrackingParams("/go/some-slug", "amazon", "kb-8")).toBe("/go/some-slug");
  });
});

describe("parseAsin", () => {
  it("accepts a bare ASIN (any case)", () => {
    expect(parseAsin("B07CSKGLMM")).toBe("B07CSKGLMM");
    expect(parseAsin("b07cskglmm")).toBe("B07CSKGLMM");
    expect(parseAsin("  B07CSKGLMM  ")).toBe("B07CSKGLMM");
  });
  it("extracts from a product URL (/dp/ and /gp/product/)", () => {
    expect(parseAsin("https://www.amazon.com/OXO-Grinder/dp/B07CSKGLMM?tag=x")).toBe("B07CSKGLMM");
    expect(parseAsin("https://www.amazon.com/gp/product/B0047BIWSK/ref=xyz")).toBe("B0047BIWSK");
  });
  it("rejects junk", () => {
    expect(parseAsin("not an asin")).toBeNull();
    expect(parseAsin("https://example.com/foo")).toBeNull();
    expect(parseAsin("")).toBeNull();
    expect(parseAsin(null)).toBeNull();
  });
});

describe("amazonProductUrl", () => {
  it("builds a /dp/ URL carrying the associate tag", () => {
    const u = amazonProductUrl("B07CSKGLMM");
    expect(u).toContain("/dp/B07CSKGLMM");
    expect(new URL(u).searchParams.get("tag")).toBe(AMAZON_ASSOCIATE_TAG);
  });
});
