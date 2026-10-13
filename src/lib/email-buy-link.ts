// Buy-button target for a pick in the results email.
//
// Non-Amazon picks go straight to the shop through the tracked redirect
// (/go/s/<suggestionId>: click logged + network subtag added). Amazon forbids
// its affiliate links in emails (Associates Operating Agreement), so Amazon
// picks — and any pick without a saved suggestion id — open the results page.

import { isAmazonItem } from "./amazon-display";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";

export function emailBuyLink(
  rec: { gift: { affiliate_url: string | null; affiliate_network?: string | null }; suggestionId?: string },
  sessionId: string,
): { href: string; label: string } {
  const amazon = isAmazonItem({ affiliate_network: rec.gift.affiliate_network, url: rec.gift.affiliate_url });
  if (rec.suggestionId && !amazon) return { href: `${baseUrl}/go/s/${rec.suggestionId}`, label: "Buy this gift →" };
  return { href: `${baseUrl}/results/${sessionId}`, label: "View this gift →" };
}
