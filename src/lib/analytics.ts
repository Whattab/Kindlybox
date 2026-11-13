// Visitor tracking IDs + a tiny event helper. These IDs are public (they ship
// to every browser), so they live in code rather than env vars.

export const GA_ID = "G-HEMMXLBT2H";
export const META_PIXEL_ID = "1016539311490403";
export const PINTEREST_TAG_ID = "2613875387035";

/** Admin pages are never tracked, so the owner's own work doesn't skew numbers. */
export function isTrackedPath(pathname: string | null | undefined): boolean {
  return !(pathname || "").startsWith("/dashboard");
}

// "Do Not Sell or Share" (CCPA/CPRA): ad pixels (Meta, Pinterest) stay off for a
// visitor who opted out on /privacy/choices or whose browser sends Global
// Privacy Control. Google Analytics (measurement only) is unaffected.
const OPT_OUT_KEY = "kb-ads-optout";

export function adsOptedOut(): boolean {
  if (typeof window === "undefined") return true;
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return true;
  try { return localStorage.getItem(OPT_OUT_KEY) === "1"; } catch { return false; }
}

export function setAdsOptOut(optOut: boolean): void {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch { /* storage blocked */ }
  const fbq = (window as unknown as { fbq?: Fn }).fbq;
  if (fbq) fbq("consent", optOut ? "revoke" : "grant");
}

type Fn = (...args: unknown[]) => void;

// Our event names → Meta standard events (so ads can optimise for them).
const META_EVENTS: Record<string, { name: string; custom?: boolean }> = {
  quiz_complete: { name: "Lead" },
  gift_click: { name: "GiftClick", custom: true },
  purchase: { name: "Purchase" },
};

// Our event names → Pinterest standard events.
const PINTEREST_EVENTS: Record<string, string> = {
  quiz_complete: "lead",
  gift_click: "custom",
  purchase: "checkout",
};

/** Send an event to GA4, the Meta Pixel and the Pinterest Tag. No-op on the server, before the scripts load, or on admin pages. */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || !isTrackedPath(window.location.pathname)) return;
  const w = window as unknown as { gtag?: Fn; fbq?: Fn; pintrk?: Fn };
  if (w.gtag) w.gtag("event", event, params);

  const pin = PINTEREST_EVENTS[event];
  if (w.pintrk && pin && !adsOptedOut()) {
    const data: Record<string, unknown> = {};
    if (params.value != null) { data.value = params.value; data.currency = params.currency || "USD"; data.order_quantity = 1; }
    if (params.transaction_id) { data.order_id = String(params.transaction_id); data.event_id = String(params.transaction_id); }
    if (event === "gift_click") data.event_name = "gift_click";
    w.pintrk("track", pin, data);
  }

  const meta = META_EVENTS[event];
  if (w.fbq && meta && !adsOptedOut()) {
    const data: Record<string, unknown> = {};
    if (params.value != null) { data.value = params.value; data.currency = params.currency || "USD"; }
    if (params.gift_name) data.content_name = params.gift_name;
    // eventID lets Meta de-duplicate a purchase if the success page is refreshed.
    const opts = params.transaction_id ? { eventID: String(params.transaction_id) } : undefined;
    w.fbq(meta.custom ? "trackCustom" : "track", meta.name, data, opts);
  }
}
