// Read whatever the admin pastes into the Amazon importer's first box:
//   • a bare ASIN            → B07CSKGLMM
//   • an Amazon product URL  → https://www.amazon.com/.../dp/B07CSKGLMM/...
//   • SiteStripe "Image" HTML → <a href=".../dp/B07CSKGLMM?tag=…"><img src="//ws-na.amazon-adsystem.com/widgets/q?…ASIN=B07CSKGLMM…"></a><img src="https://ir-na.amazon-adsystem.com/e/ir?…" …/>
// From the SiteStripe snippet we take the ASIN *and* the official SiteStripe
// image link (Amazon's sanctioned way to show its product images), so the
// image no longer has to be copied separately. Pure, so it's unit-tested.

import { parseAsin } from "./tracking";

export interface AmazonPaste { asin: string | null; imageUrl: string | null }

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function parseAmazonPaste(raw: string | null | undefined): AmazonPaste {
  const text = decode(String(raw || "").trim());
  if (!text) return { asin: null, imageUrl: null };
  if (!text.includes("<")) return { asin: parseAsin(text), imageUrl: null };

  // HTML snippet: collect href/src URLs.
  const urls = Array.from(text.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)).map((m) => m[1]);
  const asin =
    urls.map((u) => parseAsin(u)).find(Boolean) ||
    (text.match(/[?&]ASIN=([A-Z0-9]{10})/i)?.[1]?.toUpperCase() ?? null);

  // The product image — never the 1×1 tracking pixel (ir-na…/e/ir).
  const img = urls.find((u) => /amazon-adsystem\.com\/widgets\/q|media-amazon\.com\/images|images-amazon\.com\/images/i.test(u) && !/\/e\/ir\b/.test(u));
  const imageUrl = img ? (img.startsWith("//") ? `https:${img}` : img) : null;
  return { asin, imageUrl };
}
