// Merchant × category exclusions — a curation lever for when a whole affiliate
// merchant is a bad fit for an occasion or interest, regardless of how its
// products get tagged. Example: Printerval (print-on-demand novelty apparel) has
// nothing suitable for a baby shower, so we never let its products be candidates
// for that occasion. This is more robust than tag cleanup: even if a feed sync
// re-tags a Printerval item as "baby shower", the rule keeps it out.
//
// To add a rule: add the merchant (EXACT `merchant_name` as stored on products)
// with the occasions and/or interests it should be excluded from.

interface ExclusionRule {
  occasions?: string[];  // quiz occasion values (e.g. "baby shower")
  interests?: string[];  // quiz interest labels (e.g. "fashion & accessories")
}

// Keys are exact product.merchant_name values.
export const MERCHANT_EXCLUSIONS: Record<string, ExclusionRule> = {
  Printerval: { occasions: ["baby shower"] },
};

const lc = (s: string | null | undefined) => (s || "").toLowerCase().trim();

/** True when this merchant should be hidden for the given quiz answers. */
export function isMerchantExcluded(
  merchant: string | null | undefined,
  answers: { occasion?: string; interests?: string[] },
): boolean {
  const rule = merchant ? MERCHANT_EXCLUSIONS[merchant] : undefined;
  if (!rule) return false;
  const occ = lc(answers.occasion);
  if (occ && rule.occasions?.some((o) => lc(o) === occ)) return true;
  const interests = (answers.interests || []).map(lc);
  if (interests.length && rule.interests?.some((i) => interests.includes(lc(i)))) return true;
  return false;
}
