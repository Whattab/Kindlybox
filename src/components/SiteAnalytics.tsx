"use client";

// Google Analytics 4 + Meta Pixel + Pinterest Tag. Page views come from GA's enhanced
// measurement and the pixel's own history tracking (both follow client-side
// navigation); this adds the moments that matter for promotion:
//   quiz_complete — a results page was opened (once per session id)
//   gift_click    — a gift link (/go/...) was clicked through to a shop
// Purchases are sent from the order success page (TrackPurchase).
// Admin pages (/dashboard) are switched off with GA's own opt-out flag.

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GA_ID, META_PIXEL_ID, PINTEREST_TAG_ID, adsOptedOut, isTrackedPath, track } from "@/lib/analytics";

export function SiteAnalytics() {
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);

  // Set during render so it's in place before the navigation's page_view fires.
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !tracked;
  }

  // Meta Pixel loads only for visitors who haven't opted out of ad tracking.
  const [metaOn, setMetaOn] = useState(false);
  useEffect(() => { setMetaOn(!adsOptedOut()); }, []);
  // Admin pages: Meta has no opt-out flag like GA, so revoke consent there.
  useEffect(() => {
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (fbq && metaOn) fbq("consent", tracked ? "grant" : "revoke");
  }, [tracked, metaOn]);

  // Pinterest doesn't follow client-side navigation, so send a page visit on
  // route change; the base code records the page it loaded on in __kbPinPath.
  useEffect(() => {
    const w = window as unknown as { pintrk?: (...a: unknown[]) => void; __kbPinPath?: string };
    if (!metaOn || !tracked || !w.pintrk || w.__kbPinPath === pathname) return;
    w.__kbPinPath = pathname;
    w.pintrk("track", "pagevisit");
  }, [pathname, tracked, metaOn]);

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
      {metaOn && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
${tracked ? "" : "fbq('consent', 'revoke');\n"}fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
      )}
      {/* Pinterest has no consent switch, so it only loads once a public page is shown. */}
      {metaOn && tracked && (
        <Script id="pinterest-tag" strategy="afterInteractive">
          {`!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(
Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";
var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];
r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${PINTEREST_TAG_ID}');
pintrk('page');
pintrk('track', 'pagevisit');
window.__kbPinPath = location.pathname;`}
        </Script>
      )}
    </>
  );
}

/** GA4 purchase for a paid extras order. GA de-duplicates on transaction_id, so a refresh doesn't double count. */
export function TrackPurchase({ orderId, value, item }: { orderId: string; value: number; item: string }) {
  useEffect(() => {
    // The scripts may still be loading; wait briefly for both (Meta only if allowed).
    let tries = 0;
    const send = () => {
      const w = window as unknown as { gtag?: unknown; fbq?: unknown; pintrk?: unknown };
      if ((w.gtag && ((w.fbq && w.pintrk) || adsOptedOut())) || tries >= 20) {
        track("purchase", { transaction_id: orderId, value, currency: "USD", items: [{ item_id: item, item_name: item, price: value, quantity: 1 }] });
      } else if (tries++ < 20) setTimeout(send, 500);
    };
    send();
  }, [orderId, value, item]);
  return null;
}
