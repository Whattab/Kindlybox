"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Lightweight cookie notice: informs visitors that the Site uses essential,
// analytics, and affiliate cookies, and links to the Privacy Policy. Dismissal
// is remembered per-browser. This is an informational notice — if you later
// target the EU/UK, replace it with a full consent manager that blocks
// non-essential cookies until the visitor opts in.
const KEY = "kb-cookie-notice-dismissed";

export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode / blocked storage — just hide for this session */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-gray-600">
          We use cookies for essential features, privacy-friendly analytics, and affiliate referral
          tracking. See our{" "}
          <Link href="/privacy" className="font-semibold text-accent hover:underline">Privacy Policy</Link>.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
