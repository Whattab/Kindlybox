// Outbound-click tracking (Step 2, docs/quiz-decisions.md §1).
//
// Appends each affiliate network's sub-tracking parameter to a destination URL
// so a later conversion can be traced back to the quiz pick that drove it:
//   Amazon  → ascsubtag  (also injects the associate `tag` when missing, since
//             our Amazon gift links have historically shipped untagged)
//   Awin    → clickref
//   CJ      → sid
//   Rakuten → u1
//   other/Bookshop → left unchanged (no standard sub-tracking param)
//
// Pure logic (plus one env read) — safe to unit-test and to call from the
// redirect route.

import { isAmazonItem } from "@/lib/amazon-display";

// Our Amazon Associates store id. Set AMAZON_ASSOCIATE_TAG in the environment;
// the literal fallback keeps links working if the env var is missing.
export const AMAZON_ASSOCIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG || "kindlybox0c-20";

/** The sub-tracking value for one click. Maps back to session + pick + answers
 *  via the affiliate_clicks / gift_suggestions tables. */
export function clickSubtag(suggestionId: string): string {
  return `kb-${suggestionId}`;
}

/** Extract a 10-char ASIN from a bare ASIN or a full Amazon product URL
 *  (/dp/, /gp/product/, /gp/aw/d/). Returns the upper-cased ASIN or null. */
export function parseAsin(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[A-Z0-9]{10}$/i.test(s)) return s.toUpperCase();
  const m = s.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

/** Canonical Amazon product URL with our associate tag. */
export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_ASSOCIATE_TAG}`;
}

/**
 * Return `rawUrl` with the right network sub-tracking param added. Existing
 * query params are preserved. An unparseable URL is returned unchanged.
 */
export function appendTrackingParams(
  rawUrl: string,
  network: string | null | undefined,
  subtag: string,
): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl; // relative or malformed — nothing to append
  }

  const net = (network || "").toLowerCase();
  const amazon = isAmazonItem({ affiliate_network: net, url: rawUrl });

  if (amazon) {
    if (!url.searchParams.has("tag")) url.searchParams.set("tag", AMAZON_ASSOCIATE_TAG);
    url.searchParams.set("ascsubtag", subtag);
  } else if (net === "awin") {
    url.searchParams.set("clickref", subtag);
  } else if (net === "cj") {
    url.searchParams.set("sid", subtag);
  } else if (net === "rakuten") {
    url.searchParams.set("u1", subtag);
  }
  // other / bookshop / unknown → no standard param, leave as-is.

  return url.toString();
}
