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

// Amazon short links (mobile app "Share", SiteStripe "Short link") carry no
// ASIN — the server has to follow them (see amazon-shortlink.ts). Only these
// link-service hosts and Amazon's own sites are ever followed.
export const AMAZON_SHORT_HOSTS = ["link.amazon", "amzlinks.in", "amzn.to", "a.co", "amzn.eu", "amzn.com"];
const AMAZON_SITE = /(^|\.)amazon\.(com|ca|co\.uk|de|fr|it|es|in|com\.au|co\.jp|com\.mx)$/i;

const hostOf = (u: string): string | null => {
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase(); } catch { return null; }
};

/** A pasted short link we know how to open (and nothing else is pasted with it). */
export function amazonShortLink(raw: string | null | undefined): string | null {
  const text = String(raw || "").trim();
  if (!text || /\s|</.test(text)) return null;
  const host = hostOf(text);
  if (!host || !AMAZON_SHORT_HOSTS.includes(host.replace(/^www\./, ""))) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

/** Hosts a short-link hop may lead to: link services or Amazon itself. */
export function isFollowableAmazonHost(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return AMAZON_SHORT_HOSTS.includes(host.replace(/^www\./, "")) || AMAZON_SITE.test(host);
}

/**
 * A starting product name from the words Amazon puts before /dp/ in a full
 * link ("/Willow-Tree-hand-painted-sculpted-Remembrance/dp/B003OSSKWK" →
 * "Willow Tree Hand Painted Sculpted Remembrance"). Null when there's none.
 */
export function nameFromAmazonUrl(raw: string | null | undefined): string | null {
  const text = String(raw || "").trim();
  const m = text.match(/amazon\.[a-z.]+\/([^/?#\s]+)\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i);
  if (!m) return null;
  let slug: string;
  try { slug = decodeURIComponent(m[1]); } catch { slug = m[1]; }
  const words = slug.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  if (words.length < 3 || /^(dp|gp|exec|s)$/i.test(words)) return null;
  return words.split(" ").map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(" ").slice(0, 120);
}
