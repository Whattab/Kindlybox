// Server-only Stripe client. Uses STRIPE_SECRET_KEY (sk_test_… in sandbox,
// sk_live_… in production). Never import this into client components.
//
// Constructed lazily so importing this module never crashes when the key
// isn't set yet (e.g. during setup) — it only errors when payment is used.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    // Pin the API version so Stripe can't shift response shapes under us on
    // their schedule. Bump this deliberately after testing against the new
    // version. Matches the version bundled with the installed SDK.
    _stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  }
  return _stripe;
}
