// Amazon price-display rule (Step 1, see docs/quiz-decisions.md §3.5).
//
// Amazon's Associates Operating Agreement forbids displaying a price unless it
// is pulled live from the Product Advertising API. Our Amazon items carry a
// hand-entered price (used only for the server-side budget filter), so that
// number must NEVER be shown to a user — on a page, in an email, in an API
// response, or in structured data. Anywhere a price would render for an Amazon
// item, show AMAZON_PRICE_PLACEHOLDER instead.
//
// Pure logic, no imports — safe to use in server components, route handlers,
// and email templates alike.

export const AMAZON_PRICE_PLACEHOLDER = "See price on Amazon";

/** True when an item is an Amazon affiliate item, by network tag or URL host. */
export function isAmazonItem(input: {
  affiliate_network?: string | null;
  url?: string | null;
}): boolean {
  const net = (input.affiliate_network || "").toLowerCase();
  if (net === "amazon") return true;
  const url = input.url || "";
  return /amazon\./i.test(url);
}
