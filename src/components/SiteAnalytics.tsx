"use client";

// Google Analytics 4. Page views come from GA's enhanced measurement (it follows
// client-side navigation); this adds the moments that matter for promotion:
//   quiz_complete — a results page was opened (once per session id)
//   gift_click    — a gift link (/go/...) was clicked through to a shop
// Purchases are sent from the order success page (TrackPurchase).
// Admin pages (/dashboard) are switched off with GA's own opt-out flag.

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { GA_ID, isTrackedPath, track } from "@/lib/analytics";

export function SiteAnalytics() {
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);

  // Set during render so it's in place before the navigation's page_view fires.
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !tracked;
  }

  useEffect(() => {
    const m = pathname?.match(/^\/results\/([^/]+)/);
    if (!m) return;
    const key = `kb-ga-quiz-${m[1]}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage blocked: still count it */ }
    track("quiz_complete");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") || "";
      if (!href.startsWith("/go/")) return;
      track("gift_click", { link_url: href, gift_name: (a?.textContent || "").trim().slice(0, 100) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}

/** GA4 purchase for a paid extras order. GA de-duplicates on transaction_id, so a refresh doesn't double count. */
export function TrackPurchase({ orderId, value, item }: { orderId: string; value: number; item: string }) {
  useEffect(() => {
    // gtag may still be loading; retry briefly.
    let tries = 0;
    const send = () => {
      if ((window as unknown as { gtag?: unknown }).gtag) {
        track("purchase", { transaction_id: orderId, value, currency: "USD", items: [{ item_id: item, item_name: item, price: value, quantity: 1 }] });
      } else if (tries++ < 20) setTimeout(send, 500);
    };
    send();
  }, [orderId, value, item]);
  return null;
}
