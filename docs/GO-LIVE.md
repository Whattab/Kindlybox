# KindlyBox Go-Live Runbook

Taking KindlyBox from local/sandbox to a live, paid production site on Vercel +
Stripe live mode. Follow top to bottom. Each step says **who** does it and how to
**verify** it before moving on.

The application code is production-ready. Everything below is configuration and
deployment — no code changes required to go live.

---

## 0. Prerequisites (must be true before you start)

- [ ] **Stripe account activated** — business details + bank account submitted and
      approved, so `sk_live_…` keys are visible in the Stripe dashboard.
- [ ] **Vercel account** created and verified, with access to the GitHub repo
      `Whattab/Kindlybox`.
- [ ] **Domain** decided (e.g. `kindlybox.com`) — or you'll launch on the
      `*.vercel.app` URL Vercel assigns and add the custom domain later.

---

## 1. Decide: one Supabase project, or a separate production one?

This is the single most important decision and it changes several steps below.

- **Option A — reuse the current Supabase project** (simplest for launch). The
  schema and gift catalog already exist; you only run the *newest* migration if it
  hasn't been applied. Downside: test and real data share one database.
- **Option B — a fresh production Supabase project** (cleaner separation). You must
  run **all** migrations and repopulate the gift catalog from scratch.

Pick one now. The steps note "(Option B only)" where they differ.

> Note: Stripe test vs live is *always* fully separated regardless of this choice —
> live payments never touch your test data on Stripe's side.

---

## 2. Deploy to Vercel  *(you, in the Vercel dashboard)*

1. **New Project → Import** the `Whattab/Kindlybox` GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Build command and output are
   default — no overrides.
3. **Do not deploy yet** — add the environment variables (Step 3) first, or the
   first build will run with missing config. If it already deployed, that's fine;
   you'll redeploy after setting vars.

**Verify:** the project appears in Vercel and is linked to the repo's `master`
branch.

---

## 3. Set production environment variables  *(you, Vercel → Settings → Environment Variables)*

Set all of these for the **Production** environment. Names must match exactly.

| Variable | Value / source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Option B: the new project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon public key | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role key | **Secret.** Server-only. |
| `RESEND_API_KEY` | Resend dashboard | |
| `RESEND_FROM_EMAIL` | e.g. `hello@kindlybox.com` | Domain must be verified (Step 5) |
| `NEXT_PUBLIC_APP_URL` | your real URL, e.g. `https://kindlybox.com` | **No trailing slash.** See gotchas. |
| `GEMINI_API_KEY` | Google AI Studio | Model is `gemini-2.5-flash` (in code) |
| `ADMIN_EMAILS` | comma-separated admin emails | Controls `/dashboard/catalog` etc. |
| `EXTRAS_ENABLED` | `true` | **Easy to forget — hides the whole paid feature if unset.** |
| `STRIPE_SECRET_KEY` | `sk_live_…` from Stripe live mode | **Not** the `sk_test_` key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from Step 6 | Set this in Step 6, then redeploy |

**Verify:** all 11 present, Production scope, no `sk_test_`/`localhost` values left.

---

## 4. Run database migrations  *(you, Supabase → SQL Editor)*

Run each file's SQL in the SQL Editor, in this order. They're safe to re-run.

- **Option A (reuse project):** you likely only need the newest one if it hasn't
  been applied yet:
  - `supabase/migrations/20260726_gift_gender.sql`  *(the gender column)*
- **Option B (fresh project):** run **all**, in order:
  1. `20260314194428_initial_schema.sql`
  2. `20260601_auto_create_profile.sql`
  3. `20260605_gift_redirect_handler.sql`
  4. `20260607_personalized_reason.sql`
  5. `20260628_orders.sql`
  6. `20260702_orders_archived.sql`
  7. `20260703_order_reference_photos.sql`
  8. `20260726_gift_gender.sql`

**Verify:** `orders` table exists with a `stripe_session_id` column, and `gifts`
has a `gender` column.

---

## 5. Populate the gift catalog + verify email domain

- **(Option B only) Populate the catalog.** The catalog does not carry over from
  dev. Use the **Bulk import** panel at `/dashboard/catalog` (log in as an
  `ADMIN_EMAILS` user) with a CSV. Set the `gender` column deliberately
  (`male`/`female`/`unisex`) — the recommender hides opposite-gender items, and it
  only protects what you tag. Use **Replace** mode for a clean load.
- **Verify Resend sending domain.** In Resend, verify the domain behind
  `RESEND_FROM_EMAIL` (SPF/DKIM). If unverified, order/receipt emails bounce or land
  in spam — for a paying buyer that reads as "I paid and got nothing."

**Verify:** `/dashboard/catalog` shows your real gifts; Resend shows the domain as
Verified.

---

## 6. Register the Stripe webhook  *(you, Stripe dashboard in LIVE mode)*

1. Toggle the dashboard to **Live mode** (not Test).
2. **Developers → Webhooks → Add endpoint.**
3. Endpoint URL: `https://<your-domain>/api/webhooks/stripe`
4. Subscribe to **both** events:
   - `checkout.session.completed` — flips the order to paid, sends emails
   - `checkout.session.expired` — cancels abandoned orders
   *(Missing `expired` means abandoned orders never get cleaned up.)*
5. Copy the endpoint's **Signing secret** (`whsec_…`) → set it as
   `STRIPE_WEBHOOK_SECRET` in Vercel (Step 3) → **redeploy** so it takes effect.

> This live `whsec_…` is different from your local `stripe listen` secret. The CLI
> secret does not work in production.

**Verify:** after a test purchase (Step 7), the webhook shows a `200` response in
the Stripe dashboard's webhook logs.

---

## 7. Smoke test with a REAL card  *(you)*

Live mode = real money. Use a real card and a small amount (you can refund it).

1. Go to `https://<your-domain>/extras`, start an order, complete Stripe Checkout.
2. Confirm the success page settles to **"Payment received!"** (it auto-refreshes
   while waiting on the webhook).
3. In Supabase, confirm the `orders` row moved `pending_payment → paid` with a
   `stripe_payment_intent` set.
4. Confirm the buyer confirmation email **and** the admin alert email arrived.
5. Refund the test charge from the Stripe dashboard if you wish.

**Verify:** all five above. If the page stays on "Confirming your payment…", the
webhook isn't reaching the site — recheck the endpoint URL and `STRIPE_WEBHOOK_SECRET`.

---

## 8. Post-launch

- Watch the first few real orders in the Stripe **webhook logs** (all `200`) and the
  `orders` table.
- **Rollback:** if something's wrong, set `EXTRAS_ENABLED=false` in Vercel and
  redeploy — this cleanly hides the paid extras without touching anything else,
  while the rest of the site (quiz, recommendations) keeps working.

---

## Gotchas we already hit (don't relearn these)

- **`EXTRAS_ENABLED` must be `true`** in production or the entire paid feature is
  invisible.
- **Subscribe to BOTH webhook events.** `completed` alone leaves abandoned orders
  stuck forever.
- **`NEXT_PUBLIC_APP_URL` matters more than it looks.** Six files fall back to
  `https://kindlybox.com`; if prod runs on a different host and this is unset,
  checkout redirect URLs and every email link point at the wrong domain.
- **Live keys are a separate universe.** No test customers, sessions, or orders
  carry over from sandbox. The webhook endpoint and its `whsec_` are also live-only.
- **Gift `gender` only protects what you tag.** Untagged items are `unisex` and show
  for everyone.
- **Digital gift cards are NOT part of this launch** — that feature is on hold.

---

## Environment variable quick reference

```
NEXT_PUBLIC_SUPABASE_URL       # Supabase API
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase API (public)
SUPABASE_SERVICE_ROLE_KEY      # Supabase API (secret, server-only)
RESEND_API_KEY                 # Resend
RESEND_FROM_EMAIL              # verified sender, e.g. hello@kindlybox.com
NEXT_PUBLIC_APP_URL            # https://<your-domain>  (no trailing slash)
GEMINI_API_KEY                 # Google AI Studio (model: gemini-2.5-flash)
ADMIN_EMAILS                   # comma-separated admin emails
EXTRAS_ENABLED                 # true
STRIPE_SECRET_KEY              # sk_live_…
STRIPE_WEBHOOK_SECRET          # whsec_… from the LIVE webhook endpoint
```
