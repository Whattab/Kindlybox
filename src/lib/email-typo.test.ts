import { describe, it, expect } from "vitest";
import { looksLikeEmail, suggestEmailFix } from "./email-typo";

describe("suggestEmailFix", () => {
  it("fixes common domain slips", () => {
    expect(suggestEmailFix("dana@gmail.col")).toBe("dana@gmail.com");
    expect(suggestEmailFix("Dana.Smith@GMIAL.COM")).toBe("Dana.Smith@gmail.com");
    expect(suggestEmailFix("x@hotmial.com")).toBe("x@hotmail.com");
    expect(suggestEmailFix("x@yahooo.com")).toBe("x@yahoo.com");
    expect(suggestEmailFix(" x@outlok.com ")).toBe("x@outlook.com");
  });
  it("leaves valid or unknown addresses alone", () => {
    expect(suggestEmailFix("dana@gmail.com")).toBeNull();
    expect(suggestEmailFix("dana@kindlybox.com")).toBeNull();
    expect(suggestEmailFix("dana@company.co")).toBeNull();
    expect(suggestEmailFix("not-an-email")).toBeNull();
    expect(suggestEmailFix("")).toBeNull();
  });
});

describe("looksLikeEmail", () => {
  it("accepts normal addresses and rejects junk", () => {
    expect(looksLikeEmail("a@b.com")).toBe(true);
    expect(looksLikeEmail("a@b")).toBe(false);
    expect(looksLikeEmail("a b@c.com")).toBe(false);
    expect(looksLikeEmail("@c.com")).toBe(false);
  });
});
