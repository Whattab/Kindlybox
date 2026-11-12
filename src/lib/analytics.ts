// Visitor tracking IDs + a tiny event helper. These IDs are public (they ship
// to every browser), so they live in code rather than env vars.
// Meta / Pinterest IDs go here when those pixels are added.

export const GA_ID = "G-HEMMXLBT2H";

/** Admin pages are never tracked, so the owner's own work doesn't skew numbers. */
export function isTrackedPath(pathname: string | null | undefined): boolean {
  return !(pathname || "").startsWith("/dashboard");
}

type Gtag = (...args: unknown[]) => void;

/** Send a GA4 event. No-op on the server, before gtag loads, or on admin pages. */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || !isTrackedPath(window.location.pathname)) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (gtag) gtag("event", event, params);
}
