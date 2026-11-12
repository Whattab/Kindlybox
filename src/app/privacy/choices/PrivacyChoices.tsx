"use client";

import { useEffect, useState } from "react";
import { adsOptedOut, setAdsOptOut } from "@/lib/analytics";

export function PrivacyChoices() {
  const [ready, setReady] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [gpc, setGpc] = useState(false);

  useEffect(() => {
    setGpc(!!(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
    setOptedOut(adsOptedOut());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (gpc) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Your browser is sending a Global Privacy Control signal, so you&apos;re already opted out of
        advertising tracking on KindlyBox.
      </p>
    );
  }

  const toggle = () => {
    setAdsOptOut(!optedOut);
    setOptedOut(!optedOut);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <p className="font-semibold text-primary">
        {optedOut ? "You're opted out of advertising tracking on this browser." : "Advertising tracking is on for this browser."}
      </p>
      <button type="button" onClick={toggle}
        className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${optedOut ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50" : "bg-primary text-white hover:bg-primary/90"}`}>
        {optedOut ? "Turn advertising tracking back on" : "Opt out of sale/sharing"}
      </button>
      <p className="text-xs text-gray-500">
        This choice is saved in this browser only. Clearing your cookies or using another device or
        browser resets it — opt out there too.
      </p>
    </div>
  );
}
