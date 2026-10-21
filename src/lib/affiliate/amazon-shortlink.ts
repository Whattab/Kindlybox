// Server-only: open an Amazon short link (link.amazon/…, amzn.to/…, a.co/…)
// and return the product's ASIN plus the full product link it led to. Follows redirects by hand so every hop can be
// checked — only Amazon's link services and Amazon sites are ever requested.

import { parseAsin } from "./tracking";
import { amazonShortLink, isFollowableAmazonHost } from "./amazon-paste";

const MAX_HOPS = 5;

export async function resolveAmazonShortLink(raw: string): Promise<{ asin: string; url: string } | null> {
  let url = amazonShortLink(raw);
  for (let hop = 0; url && hop < MAX_HOPS; hop++) {
    const asin = parseAsin(url);
    if (asin) return { asin, url };
    if (!isFollowableAmazonHost(url)) return null;
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "Mozilla/5.0 (KindlyBox importer)" },
      });
    } catch {
      return null;
    }
    const next = res.headers.get("location");
    if (!next) return null;
    url = new URL(next, url).toString();
  }
  const asin = url ? parseAsin(url) : null;
  return asin && url ? { asin, url } : null;
}
