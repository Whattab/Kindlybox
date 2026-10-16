// Group gifting helpers — pure, no Supabase. Payment handles are cleaned and
// validated here so the page only ever builds links to the real Venmo / PayPal
// / Cash App domains with a safe path segment.

export const MAX_MEMBERS = 50;
export const MAX_NAME = 40;
export const MAX_NOTE = 280;

/** Trim + collapse whitespace + cap length. Empty → "". */
export function cleanName(input: unknown, max = MAX_NAME): string {
  return String(input ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Each handle accepts the shopper's usual spelling (with @ / $ / full link)
// and returns just the handle, or null when it isn't a plausible one.
export function venmoHandle(input: unknown): string | null {
  const s = String(input ?? "").trim().replace(/^https?:\/\/(www\.)?venmo\.com\/(u\/)?/i, "").replace(/^@/, "").replace(/\/$/, "");
  return /^[A-Za-z0-9_-]{2,30}$/.test(s) ? s : null;
}

export function paypalHandle(input: unknown): string | null {
  const s = String(input ?? "").trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "").replace(/\/$/, "");
  return /^[A-Za-z0-9]{2,20}$/.test(s) ? s : null;
}

export function cashappHandle(input: unknown): string | null {
  const s = String(input ?? "").trim().replace(/^https?:\/\/(www\.)?cash\.app\//i, "").replace(/^\$/, "").replace(/\/$/, "");
  return /^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(s) ? s : null;
}

export type PayLink = { label: string; handle: string; href: string };

/** Pay-the-organiser links, amount pre-filled where the app supports it. */
export function payLinks(
  g: { pay_venmo?: string | null; pay_paypal?: string | null; pay_cashapp?: string | null },
  share: number | null,
): PayLink[] {
  const amt = share && share > 0 ? share.toFixed(2) : null;
  const links: PayLink[] = [];
  const v = venmoHandle(g.pay_venmo);
  if (v) links.push({ label: "Venmo", handle: `@${v}`, href: `https://venmo.com/u/${v}` });
  const p = paypalHandle(g.pay_paypal);
  if (p) links.push({ label: "PayPal", handle: p, href: `https://paypal.me/${p}${amt ? `/${amt}USD` : ""}` });
  const c = cashappHandle(g.pay_cashapp);
  if (c) links.push({ label: "Cash App", handle: `$${c}`, href: `https://cash.app/$${c}${amt ? `/${amt}` : ""}` });
  return links;
}

/** Parse a typed total ("$89.99", "90") → dollars, or null if not a sane amount. */
export function parseAmount(input: unknown): number | null {
  const n = Number(String(input ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? Math.round(n * 100) / 100 : null;
}

/** Each person's share, rounded UP to the cent so the organiser is never short. */
export function splitShare(total: number | null, people: number): number | null {
  if (!total || total <= 0 || people < 1) return null;
  return Math.ceil((total * 100) / people) / 100;
}

/** Votes per suggestion id. */
export function tallyVotes(members: { vote_suggestion_id: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of members) if (m.vote_suggestion_id) out[m.vote_suggestion_id] = (out[m.vote_suggestion_id] || 0) + 1;
  return out;
}

/** Constant-time-ish string compare for the manage key. */
export function sameKey(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
