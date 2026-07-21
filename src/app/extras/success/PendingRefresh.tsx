"use client";

// Stripe redirects the buyer here the instant checkout completes, which can be
// a beat before the webhook flips the order to "paid". Re-fetch the server
// component every few seconds so the page settles on its own instead of asking
// the buyer to reload. Gives up after ~30s so we're not polling forever.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PendingRefresh() {
  const router = useRouter();

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 30_000) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
