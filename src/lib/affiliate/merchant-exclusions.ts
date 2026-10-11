// Merchant × category exclusions — a curation lever for when a whole affiliate
// merchant is a bad fit for an occasion or interest, regardless of how its
// products get tagged. Example: Printerval (print-on-demand novelty apparel) has
// nothing suitable for a baby shower, so we never let its products be candidates
// for that occasion. This is more robust than tag cleanup: even if a feed sync
// re-tags a Printerval item as "baby shower", the rule keeps it out.
//
// ─── HOW TO ADD A RULE (owner-editable) ────────────────────────────────────
// Add a line to MERCHANT_EXCLUSIONS below. The key is the EXACT merchant name,
// the value lists the occasions and/or interests to hide that merchant from.
// After editing, the change goes live on the next deploy (commit + push to
// master, or ask Claude to deploy).
//
//   "PawFurEver": { occasions: ["baby shower", "wedding"] },
//   "Printerval":  { occasions: ["baby shower"], interests: ["jewelry"] },
//
// VALID MERCHANT NAMES (exact — copy from here):
//   BOOKSAMILLION.COM · Black Canyon Home & Body · Lucasgift - US · Printerval
//   Flowers Fast.com-Send Flowers Same Day Delivery · Abracadabra NYC · BBBGEM
//   Watches Of USA · LOOMY Home · Giftcards.com · PawFurEver
//   Mosaic Weighted Blankets · GraphicAudio · Bond Touch
//
// VALID OCCASIONS:
//   birthday · anniversary · graduation · baby shower · wedding · valentine's day
//   promotion/retirement · house warming · mother's day · father's day · holidays
//   thank you · sympathy · just because
//
// INTERESTS: any interest label (e.g. fashion & accessories, jewelry, pets,
//   home & kitchen, gaming, …). Omit `interests` to block by occasion only.
// ────────────────────────────────────────────────────────────────────────────

interface ExclusionRule {
  occasions?: string[];  // quiz occasion values (e.g. "baby shower")
  interests?: string[];  // quiz interest labels (e.g. "fashion & accessories")
}

// Keys are exact product.merchant_name values. Add your rules here:
export const MERCHANT_EXCLUSIONS: Record<string, ExclusionRule> = {
  Printerval: { occasions: ["baby shower"] },
  PawFurEver: { occasions: ["baby shower", "wedding"] },
  "Lucasgift - US": { occasions: ["sympathy"] },
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
