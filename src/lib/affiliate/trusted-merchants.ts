// Temporary safety gate (Step 1 of the quiz upgrade, see docs/quiz-decisions.md §1).
//
// Until real product staging/approval exists (Step 3), only feed products from a
// hand-vetted allowlist of merchants are eligible to appear in quiz results. Any
// NEW merchant that shows up in a future sync is excluded from the quiz until it
// is added here on purpose — so an untrusted merchant can never auto-surface.
//
// This gates ONLY affiliate `products` (network feeds). Curated `gifts` are not
// affected. To add/remove a merchant, edit the list below (use the exact
// `merchant_name` string as stored in the products table).

export const TRUSTED_MERCHANTS: ReadonlySet<string> = new Set([
  "Flowers Fast.com-Send Flowers Same Day Delivery",
  "Printerval",
  "Lucasgift - US",
  "Watches Of USA",
  "PawFurEver",
  "LOOMY Home",
  "GraphicAudio",
  "BBBGEM",
  "Bond Touch",
]);

export function isTrustedMerchant(name: string | null | undefined): boolean {
  if (!name) return false;
  return TRUSTED_MERCHANTS.has(name);
}
