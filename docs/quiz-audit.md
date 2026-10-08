# KindlyBox Quiz & Recommendation Audit

**Date:** 2026-10-02
**Scope:** Read-only audit of the gift quiz, recommendation engine, product data model, affiliate wiring, and the supporting Supabase schema — measured against the "smarter quiz" target vision.
**Status:** Report only. No code, data, or schema was changed.

---

## 1. Current State — how it works today

### 1.1 Stack & deployment
- **Next.js 14.2.35** (App Router), React 18, TypeScript, Tailwind. `package.json`.
- **Supabase** (Postgres + Auth + Storage) via `@supabase/ssr` and `@supabase/supabase-js`.
- **Email:** Resend (`resend` + `@react-email`). **Payments:** Stripe. **AI:** Google Gemini (`@google/generative-ai`).
- **Deploy:** GitHub (Whattab/Kindlybox) → **Vercel** auto-deploy on push to `master`. One Vercel cron: daily affiliate sync at 06:00 UTC (`vercel.json`).
- Build is lax: `typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` are on, and `images.remotePatterns` allows **any** https host (`next.config.mjs`). Type/lint errors do not block deploys.

### 1.2 Quiz flow — a fixed 7-step form (no branching)
- UI: [src/components/quiz/QuizFlow.tsx](../src/components/quiz/QuizFlow.tsx) — a single client component with a hardcoded `quizSteps` array.
- Page shell + URL prefill: [src/app/quiz/page.tsx](../src/app/quiz/page.tsx) (reads `recipient/occasion/budget/ageGroup/gender/interests` from `searchParams` — used by reminder emails to pre-fill).
- **Steps, always in this order:** occasion → recipient (+ optional recipient name) → age group → gender → interests (pick up to 3, + one free-text box) → budget → email capture (skipped if logged in).
- The flow is **linear and static**: `nextStep()`/`prevStep()` just increment an index (`QuizFlow.tsx:128-143`). No answer ever changes which question comes next, and no question is ever skipped (except email for logged-in users). Every user answers all 7.
- Questions are **category-based**, not life-based ("What are their hobbies?" with product-category chips like "Home & Kitchen"), which is the opposite of the target ("about the person's life, not product categories").
- Submit: `POST /api/quiz/submit` → on success routes to `/results/<sessionId>`.

### 1.3 Recommendation logic — single-stage keyword scoring
- Core: [src/lib/recommend.ts](../src/lib/recommend.ts) — `getRecommendations(answers, catalogue, {seed})`.
- API orchestration: [src/app/api/quiz/submit/route.ts](../src/app/api/quiz/submit/route.ts).
  1. Loads **all active `gifts`** (`select("*").eq("active", true)`).
  2. Loads a pre-filtered slice of affiliate **`products`** via `loadProductCandidates()` ([src/lib/affiliate/candidates.ts](../src/lib/affiliate/candidates.ts)) — SQL-filtered by gender, budget band, and tag/recipient/occasion overlap (GIN indexes), capped at a few hundred rows.
  3. Concatenates both into one `catalogue` and scores them identically ("free blend").
- **Scoring** (`recommend.ts:203-431`): filter by budget → gender → drop sympathy items → age filter, then a **weighted keyword score**:
  - Interests are the dominant signal: exact tag match `34`, vocabulary/keyword match `12` (via `INTEREST_VOCAB`), recipient `20`, occasion `18`, free-text tokens `6` (max 4), theme signals `8` (max 3), price-fit `8`, age-fit `8`, purchasable `4`.
  - Ties broken by #reasons, then by having a real destination, over a deterministic seeded shuffle so equally-good gifts rotate.
  - Returns the top 3 **distinct** (deduped by name), preferring "qualified" matches; falls back so the quiz never dead-ends.
- This is **one-stage**: hard filters and scoring live in the same pass, but there is **no deliberate diversity** step — the final 3 can all be the same style/type. There is no style, gift-type, experience-level, delivery-speed, rating, or hierarchical-interest signal (none of those exist in the data).
- **Free text is NOT interpreted by AI.** It is tokenized and keyword-matched (`recommend.ts:211-215, 332-345`). Gemini is used **only** to write the post-hoc "why we picked this" sentence.

### 1.4 AI usage
- [src/lib/personalize.ts](../src/lib/personalize.ts): Gemini **`gemini-2.5-flash`**, one call per recommended gift (3 per quiz), generating a one-line "why this fits" note. Fails soft to a templated fallback (`buildFallbackNote`). Capped at 120 output tokens, thinking disabled, 2 retries. Key: `GEMINI_API_KEY`.
- Gemini is also used in the **content/article** pipeline (`src/lib/intelligence/*`, `writer.ts`) — separate from the quiz.
- **No AI touches recommendation selection or tag interpretation.** The "interpret free text into existing tags only" target item does not exist.

### 1.5 "Why this fits" explanation
- **Exists.** Generated at submit time, stored on `gift_suggestions.personalized_reason` (migration `20260607_personalized_reason.sql`), rendered in the results card and the email. Tied to quiz answers via the prompt (`personalize.ts:44-78`). This is the most mature part of the target vision.

### 1.6 Product data model & ingestion (hybrid-ish, but no staging)
- **Two catalogues:**
  - `gifts` — hand-curated / manually added (also where **Bookshop.org books** land via [src/app/dashboard/books](../src/app/dashboard/books), and where Amazon items would go if added). Columns: name, description, image_url, price_min/max, `tags/occasions/recipients` (text[]), gender, slug, destination_url, affiliate_url/network, active. Schema: `20260314194428_initial_schema.sql`, `20260605_gift_redirect_handler.sql`, `20260726_gift_gender.sql`.
  - `products` — network feeds (Awin, CJ, Rakuten). Schema: `20260830_affiliate_products.sql`. Columns include `network, network_product_id, merchant_name, title, price, tags/occasions/recipients (text[]), gender, affiliate_link, in_stock, active, last_seen_at`. GIN indexes on tags/occasions/recipients.
- **Ingestion:** nightly cron [src/app/api/cron/affiliate-sync/route.ts](../src/app/api/cron/affiliate-sync/route.ts) runs `syncAwin` / `syncCj` / `syncRakuten`. Each downloads the feed, **auto-normalizes tags** from merchant profiles + keyword rules ([src/lib/affiliate/normalize.ts](../src/lib/affiliate/normalize.ts)), upserts, and deactivates rows not seen this run. Re-tagging in place: `scripts/retag-products.ts`.
- **Tags are `text[]` columns**, not a relational tag system. There is **no `tags` table, no `product_tags` join, no weights, no `ltree` hierarchy, no `tag_synonyms`.**
- **No staging/approval workflow.** `products` has `active`/`in_stock` but **no `status` (staged/approved/rejected)** column. Synced products go live automatically once tagged; there is no human approval gate. (The `staged/approved/rejected` pattern that *does* exist is for the **articles** content pipeline, not products — `20260817_intelligence_engine.sql`.)
- **Amazon** is manual (SiteStripe links in `gifts` / article blocks); not synced; no PA-API (gated until 10 sales).

### 1.7 Affiliate links & click tracking
- Two link paths:
  - **Results page** ([src/app/results/[sessionId]/page.tsx:175-183](../src/app/results/%5BsessionId%5D/page.tsx)) links **directly** to `gift.affiliate_url` / `product.affiliate_link` (new tab, `rel="sponsored nofollow"` for products).
  - **Redirect route** [src/app/go/[slug]/route.ts](../src/app/go/%5Bslug%5D/route.ts) — looks up a **gift by slug** and 302s to `destination_url`. Used by emails/blog, **but the results page bypasses it.** It only works for `gifts` (not `products`).
- **No click tracking whatsoever.** `gift_suggestions.clicked_at` exists (`initial_schema.sql:79`) but is **never written** anywhere in the codebase. Outbound links do not record who clicked what, and **the quiz path is not encoded** into any network's tracking parameter (no Amazon subtag, CJ SID, Awin `clickref`, or Rakuten `u1`). The "learning loop" does not exist.
- No post-occasion "Did they love it?" feedback mechanism exists.

### 1.8 Results page & refinement
- [src/app/results/[sessionId]/page.tsx](../src/app/results/%5BsessionId%5D/page.tsx): renders the 3 picks (gift or product, normalized), the AI "why" note, price, Buy button, and **Save to profile** (logged-in → `saveGiftToProfile`; logged-out → login redirect). **Share** buttons exist (`ShareButtons`). A KindlyBox digital-extra callout is appended when `EXTRAS_ENABLED` (`suggestDigitalExtra`, rules-based, no AI). Affiliate disclosure is a small centered footer line.
- **No refinement controls.** There are **no** "Cheaper / More unique / Arrives sooner / Experience instead" buttons and **no per-pick "Not quite" swap.** Results are static once generated.

### 1.9 Saved profiles, occasions, reminders
- **Occasions + reminders exist.** `occasions` and `reminders` tables (`initial_schema.sql`), created from the dashboard ([src/app/dashboard/occasions/actions.ts](../src/app/dashboard/occasions/actions.ts) inserts future-dated reminders). Reminder emails sent by [src/app/api/reminders/process/route.ts](../src/app/api/reminders/process/route.ts), which **pre-fills the quiz** via URL params from the occasion.
- **"Save to profile"** writes to `purchases` (via `results/.../actions.ts`).
- **No reusable recipient profiles** that let you "skip to results," avoid repeat gifts, or carry interest/avoid data between quizzes. `occasions.recipient_*` are free-text fields, not structured recipient records tied to quiz answers or gift history.

### 1.10 Schema summary (public schema)
| Table | Purpose | RLS |
|---|---|---|
| `profiles` | user settings, timezone, reminder_days | owner-scoped ✅ |
| `occasions` | saved events | owner-scoped ✅ |
| `reminders` | reminder queue | owner-scoped ✅ |
| `gifts` | curated catalogue (+ books, Amazon manual) | public read of `active` ✅; writes service-role |
| `products` | network feeds (Awin/CJ/Rakuten) | **service-role only** (no public policy) ✅ |
| `quiz_sessions` | answers + captured email | owner read; writes service-role ✅ |
| `gift_suggestions` | the 3 picks per session | owner-via-session read; writes service-role ✅ |
| `purchases` | saved/ordered gifts | owner-scoped ✅ |
| `affiliate_sync_runs` | sync observability | service-role only ✅ |
| + orders/articles/intelligence tables | checkout & content pipeline | RLS present (later migrations) |

RLS was **re-secured** in `20260823_rls_restore.sql` after a period where the anon key could read all sessions/profiles and delete gifts. Current policies look correct. Defaults: `profiles.timezone='Europe/London'`, `default_currency='GBP'` — stale for a US-focused site.

---

## 2. Gap Analysis vs. target vision

Legend: ✅ exists · 🟡 partial · ❌ missing

### Target item 1 — Rich tagged catalog (relationship, age, occasion, style, gift type, experience level, avoid flags, price, shipping, 3-level interest tree)
**🟡 Partial.** `gifts`/`products` carry `tags/occasions/recipients` (text[]), price, gender. **Missing:** gift *style* (practical/sentimental/luxe/quirky/experience), gift *type* (physical/experience/consumable/personalized/digital), *experience level*, *avoid flags*, *shipping speed*, and any **hierarchical** interest tree. Tags are flat arrays with no weights and no synonyms.

### Target item 2 — Branching questions (5–8 adaptive taps)
**❌ Missing.** The flow is a fixed 7-step linear form (`QuizFlow.tsx`). No conditional next-question logic, no skipping.

### Target item 3 — Better questions (life-based, picture choices, "avoid" options)
**🟡 Partial.** Choices have icons (not photos). Questions are **product-category** based, not life-based. There are **no "avoid"/dealbreaker options** (no alcohol, minimalist, "has everything", etc.).

### Target item 4 — One optional free-text, AI→existing tags only
**🟡 Partial.** The free-text box exists (`QuizFlow.tsx:322-334`), but it is **keyword-matched, not AI-interpreted into tags** (`recommend.ts`). Gemini is only used for the "why" note.

### Target item 5 — Two-stage recommendation (hard filters → weighted scoring → diverse final 3)
**🟡 Partial.** Hard filters (budget/gender/age/sympathy) + weighted scoring exist in `recommend.ts`, with more points for exact interest matches. **Missing:** deeper-match weighting for a *hierarchy* (no hierarchy exists), occasion/style/rating signals beyond basics, delivery-deadline filtering, avoid-flag filtering, and the **deliberate diversity** of the final 3 (practical/sentimental/experience).

### Target item 6 — "Why this fits" per pick
**✅ Exists.** `personalize.ts` + `gift_suggestions.personalized_reason`, tied to answers. The strongest-built feature.

### Target item 7 — Results refinement (Cheaper / More unique / Arrives sooner / Experience instead; "Not quite" swap; save & share)
**🟡 Partial.** Save ✅ and Share ✅ exist. **All refinement buttons and the per-pick "Not quite" swap are missing.** Results are static.

### Target item 8 — Learning loop (tag clicks with quiz path per network; post-occasion feedback)
**❌ Missing.** No click tracking (`clicked_at` unused), no per-network tracking params carrying the quiz path, no feedback capture. Only a session-level `match_score` is stored.

### Target item 9 — Saved recipient profiles (skip to results, avoid repeats, power reminders)
**🟡 Partial.** Occasions + reminders + saved purchases exist and reminders pre-fill the quiz. **Missing:** structured, reusable recipient profiles that store interests/avoids and drive "skip to results" + repeat-avoidance.

### Hybrid product model (selective staging imports, AI-suggested tags from an approved list with human approval, scheduled price/stock/image-only resync, Amazon manual by ASIN, no Amazon price unless from API)
**🟡 Partial.**
- Selective imports: 🟡 feeds are imported and auto-tagged, but **not into a staging table** and **not with per-merchant selectivity beyond blocklists/profiles**.
- AI-suggested tags from approved list + human approval: ❌ tagging is **rule/keyword-based**, not AI, and there is **no approval gate** (no `status` column).
- Scheduled price/stock/image-only resync: 🟡 the nightly sync **re-tags every run** (it does not preserve human tags — it overwrites from the normalizer), so a "don't touch tags" resync does not exist.
- Out-of-stock hidden: 🟡 `in_stock`/`active` exist and unseen rows are deactivated; verify the candidate query actually excludes `in_stock=false` (today it filters `active=true` + non-null image only — see Risk R5).
- Amazon manual by ASIN: ✅ (SiteStripe). No Amazon price from API: 🟡 — **no PA-API**, but manually-entered Amazon prices are displayed (see Risk R2).

---

## 3. Risks & problems (ranked by severity)

**R1 — No approval gate on auto-tagged feed products going live (Medium-High / data quality).**
Synced products are tagged by keyword rules and become quiz-eligible immediately. The codebase history shows repeated tag-quality problems (garbage products under wrong tags, an anti-vax tee nearly shipped into a "Mom" guide). Without a `status=staged→approved` gate, a bad feed row can surface in results the next morning. Also: `retag-products.ts` / nightly normalize **overwrite tags in place**, so any manual correction is lost on the next sync.

**R2 — Amazon price display may violate the Associates Operating Agreement (Medium / compliance).**
Amazon forbids displaying a price unless pulled live from their Product Advertising API. Amazon items are added manually with a hand-entered price, and prices are rendered on article product cards (and would render in quiz results if an Amazon item were in `gifts`). Confirm no manually-entered Amazon price is shown; if any are, remove the price or show "See price on Amazon." (Non-Amazon feed prices from Awin/CJ/Rakuten are fine.)

**R3 — No click tracking = no attribution and no learning loop (Medium / growth).**
`clicked_at` is never written and the quiz path is not encoded into network subtags. You cannot tell which quiz answers drive clicks/sales, cannot do the planned learning loop, and lose per-path conversion insight. (Not a security issue — just blind.)

**R4 — `getRecommendations` loads the entire `gifts` table every quiz (Low-Medium / performance).**
`submit/route.ts` does `from("gifts").select("*").eq("active", true)` with no limit, then scores in JS. Fine at current catalogue size; will degrade as `gifts` grows (books are being bulk-added). `products` is already pre-filtered in SQL; `gifts` is not.

**R5 — Out-of-stock products can still be recommended (Low-Medium / UX+compliance).**
`loadProductCandidates` filters `active=true` and `image_url not null` but **does not filter `in_stock=true`** (`candidates.ts:60`). A product in the feed but out of stock can be suggested, sending buyers to a dead/again-unavailable listing.

**R6 — Synchronous Gemini + Resend calls on the submit path (Low / performance+reliability).**
The quiz submit awaits 3 Gemini calls and an email send before responding. Both fail soft, but they add latency to the visitor's "Finding gifts…" wait and couple the response to third-party uptime. Consider generating the "why" notes and sending email after the session row is created / in the background.

**R7 — Default timezone/currency are UK (`Europe/London`/`GBP`) on a US site (Low / correctness).**
`profiles` defaults (`initial_schema.sql:11-12`) will mis-schedule reminders and mislabel currency for US users.

**R8 — Build ignores type & lint errors; images allow any host (Low / hygiene).**
`ignoreBuildErrors`/`ignoreDuringBuilds` and `remotePatterns: '**'` mean regressions ship silently and any remote image URL is trusted. Acceptable for velocity, worth revisiting.

**No critical security holes found** in the quiz/results path: service-role clients are only used in server components/route handlers and server actions (not shipped to the browser), RLS is restored and owner-scoped, results rely on unguessable session UUIDs, and cron routes check `CRON_SECRET` in production.

---

## 4. Implementation order

> **Superseded by [docs/quiz-decisions.md](quiz-decisions.md).** The owner's decisions file replaces this section's original phase order and the Phase 0 tag-system recommendation. Where the two disagree, the decisions file wins. The 8-step order below mirrors `quiz-decisions.md` §1; the tag design lives in that file's §2 and the branching question graph in its §4. Work one step at a time, each starting in plan mode and waiting for owner approval before code is written.

| Step | Work | Maps to (old) | Key notes |
|---|---|---|---|
| **1** | **Quick wins + trusted-merchant safety gate** | R5, R2, R7 + temp R1 | Fix **R5** (filter `in_stock=true` in candidates). Fix **R2** (stop displaying manually-entered Amazon prices; show "See price on Amazon"). Fix **R7** (US defaults for new profiles: `America/Chicago`, `USD`). Temp **R1** safety: only products from a trusted-merchant allowlist are quiz-eligible until staging exists. |
| **2** | **Click tracking + network subtags** | old Phase 4 (minus feedback email) | Route all outbound clicks (gifts + products) through a tracking redirect; write `clicked_at` + session + pick; append quiz path to Amazon tag / CJ SID / Awin `clickref` / Rakuten `u1`. Baseline data before changing the quiz. |
| **3** | **Tag taxonomy + staging/approval** | old Phase 0 | Use the tag design in decisions §2 (`tags` table as source of truth, `ltree` hierarchy, `text[]` on products/gifts, `tag_synonyms`, review queue). Nightly sync updates price/stock/image only — never overwrites approved tags. |
| **4** | **AI tagging + free-text interpretation** | old Phases 1 + 3 merged | One shared Gemini capability mapping text → approved tags only; used for feed tagging and the quiz free-text answer. Keyword matching stays as fallback. |
| **5** | **Two-stage recommender + diversity** | old Phase 2 | Stage A hard filters → Stage B weighted scoring → adaptive diversity (decisions §3.3). Also fix **R4** (pre-filter `gifts` in SQL). |
| **6** | **Branching quiz** | old Phase 5 | Decision-graph questions per decisions §4. Ship behind a **feature flag** so old/new quizzes can be compared and the new one disabled instantly. |
| **7** | **Results refinement buttons** | old Phase 6 (part) | Cheaper / More unique / Experience instead / Last-minute ideas, plus per-pick "Not quite" swap. |
| **8** | **Recipient profiles + post-occasion feedback** | old Phase 6 (part) + new | New `recipients` table (occasions link via `recipient_id`); "Did they love it?" email + capture table. |

**Holiday caution (decisions §1):** avoid deploying risky quiz changes between mid-November and December 31 unless behind a feature flag.

**Engineering rules in force (decisions §6):** plan-mode-first per step; stay within the current step's scope; run `tsc --noEmit` + tests before every commit; DB changes only via new migration files tested on dev Supabase (never prod first); secrets stay in env; after each step, summarize + explain testing + mark the step complete here.

### Step 1 — ✅ Complete (2026-10-03, branch `quiz-upgrade`)
- **R5 + R1 gate** (`candidates.ts`, new `trusted-merchants.ts`): quiz product candidates now require `in_stock=true` AND a merchant on the 9-merchant allowlist. Verified live: 0 untrusted merchants leak, 1 OOS row excluded.
- **Keyword blocklist** (new `blocklist.ts`): feed-product titles matching political/offensive/medical-claim/trademark terms are dropped from quiz candidates. Tuned to avoid false positives (bare `treats`/`heal`/`cure`/`miracle` removed so pet treats and "Hope Heals" bouquets pass). Live: blocks the political hoodies, clears the bouquet.
- **R2 Amazon price leaks** (new `amazon-display.ts`): hand-entered Amazon prices no longer shown anywhere — results page, results email (`GiftSuggestions.tsx`), quiz-submit API response, and blog article cards all render "See price on Amazon". Verified clean: Gemini prompt, reminder email, blog JSON-LD, results JSON-LD. DB prices kept for internal budget filtering only.
- **R7** (migration `20261003_us_profile_defaults.sql`): new-profile defaults set to `America/Chicago` + `USD`. **Not yet applied** — owner to run on dev then prod.
- **Testing:** Vitest added (`npm test`) — 15 unit tests across the 3 new helpers, all passing; `tsc --noEmit` introduces no new errors in Step 1 files (pre-existing project errors untouched).
- **Deferred:** the R7 migration must be applied to Supabase; nothing pushed/deployed.

### Step 2 — ✅ Complete (2026-10-03, branch `quiz-upgrade`)
- **Tracking redirect** (new `src/app/go/s/[id]/route.ts`): quiz results "Buy" clicks now route through `/go/s/<suggestionId>`, which resolves the pick's destination, appends the network subtag, logs the click, and 302s out. Results page Buy buttons rerouted ([results page](src/app/results/[sessionId]/page.tsx)); feed products + curated gifts both covered. The email links to the results page (not affiliate), so no email change.
- **Network subtags** (new `src/lib/affiliate/tracking.ts`): appends `ascsubtag` (Amazon), `clickref` (Awin), `sid` (CJ), `u1` (Rakuten); Bookshop/other unchanged. Subtag value `kb-<suggestionId>` maps back to session + pick + answers.
- **Amazon attribution fix:** Amazon gift links were shipping **untagged** (no commission). The redirect now injects `tag=` (from new `AMAZON_ASSOCIATE_TAG` env, fallback `kindlybox0c-20`) when missing. Verified on live data: tag injected + ascsubtag added.
- **Click log** (migration `20261003_affiliate_clicks.sql`): new service-only `affiliate_clicks` table (session, suggestion, source, ids, network, subtag, destination, time); also sets `gift_suggestions.clicked_at` on first click. Logging is fail-soft.
- **Testing:** 9 new tracking unit tests (24 total, all pass); `tsc --noEmit` no new errors; live read-only check confirmed correct param appending per network.
- **Owner actions:** apply `affiliate_clicks` migration (dev→prod); set `AMAZON_ASSOCIATE_TAG=kindlybox0c-20` in `.env.local` + Vercel. (Still nothing pushed/deployed.)

### Step 3a — ✅ on dev + prod (2026-10-05, branch `step-3a`)
- **Tag taxonomy data layer** (migration `20261005_tag_taxonomy.sql`, `scripts/seed-tags.ts`): new `tags` table (Postgres `ltree` hierarchy) + `tag_synonyms`, seeded with **129 tags** across 8 dimensions (interest tree of 14 roots + 65 children; recipient, life_stage, occasion, style, gift_type, experience_level, avoid_flag) and **73 synonyms**. `label` matches the exact strings already in `gifts.tags`/`products.tags`, so no catalogue rewrite.
- **Dev-first:** `kindlybox-dev` set up and schema-mirrored; 3a applied + seeded + verified on dev. Nothing reads these tables yet (inert data layer), so zero risk to the app.
- **Promoted to prod** (migration + `seed-tags.ts --prod`); verified identical to dev (129 tags / 73 synonyms). Next: 3b (tag columns on products/gifts + combined view), then 3c (staging/approval).

### Step 3b — ✅ on dev + prod (2026-10-05, branch `step-3b`)
- **Catalogue tag columns + combined view** (migration `20261005_catalogue_view.sql`): added `style[]`, `gift_type[]`, `avoid_flags[]`, `experience_level`, `primary_interest` to **both** `products` and `gifts` (empty defaults; Step 4 fills them), with a static `experience_level` CHECK and GIN indexes on the product array columns. Created the `catalogue` **view** (`security_invoker = true`) unifying active gifts + active products for the Step 5 recommender.
- **Verified on dev:** union works via service role; the CHECK rejects bad values; and the anon key sees **only gifts** through the view (products RLS holds — no leak). Nothing reads the view yet.
- **Promoted to prod**; verified with real data (service role via `catalogue`: 64 gifts + 11,541 products; anon: 64 gifts + 0 products — no leak). Then 3c.

### Step 3c — ✅ on dev + prod + deployed (2026-10-07, branch `step-3c`)
- **Staging & approval workflow** (migration `20261006_product_status.sql`): `products.status` (staged/approved/rejected, default approved); `catalogue` view now exposes `status`.
- **Two-tier blocklist redesign** ([blocklist.ts](src/lib/affiliate/blocklist.ts)): `isHardBlocked` (slurs/explicit/hate/restricted/medical-claim → reject), `isReviewFlagged` (mild profanity/partisan/rec-drugs → stage), `isTrademarkBlocked` (reject only on untrusted merchants). Removed false positives (`xxx`, bare `treats`/`heals`/`cure`, bare `harris`). Added `Giftcards.com` to trusted merchants.
- **Stage-aware, tag-safe sync** (new [upsert-products.ts](src/lib/affiliate/upsert-products.ts)): `computeStatus` + partition new/existing; existing rows get volatile fields only (tags/status preserved). All three syncs refactored to use it.
- **Quiz gate** ([candidates.ts](src/lib/affiliate/candidates.ts)): now `status='approved'` + in_stock (retires Step 1's trusted-merchant filter); blocklist is merchant-aware (legit Gucci watches no longer excluded).
- **Admin review queue** ([products dashboard](src/app/dashboard/products/page.tsx) + `actions.ts`): status/merchant/category/price filters, per-card Approve/Reject, and bulk approve-all/reject-all for the filtered set.
- **Verified on dev:** tag-safe upsert (existing tags preserved, price updated), status computation, approved-only gate, view `status` column. 35 unit tests pass.
- **Prod:** migration applied; `restatus-existing-products.ts --prod` set 18 → staged, 0 rejected, 11,523 approved (quiz-eligible: 11,522). Code merged to master + deployed. Step 1's trusted-merchant quiz gate retired. **Step 3 complete.** ⚠ **Awin sync is failing (pre-existing, since ~Sep 18) — deferred until after the quiz upgrade; see memory `awin-sync-broken`.**

### Step 4a — ✅ on dev (2026-10-07, branch `step-4a`)
- **Free-text → approved tags** (new [ai-tags.ts](src/lib/ai-tags.ts)): `interpretFreeText(text)` maps a shopper's note to **existing** taxonomy labels only — a deterministic synonym/label layer + a Gemini pass (same fail-soft client as personalize), with hallucinations dropped and results capped. No migration (reads 3a's `tags`/`tag_synonyms`).
- **Wired into the quiz** ([submit route](src/app/api/quiz/submit/route.ts)): interpreted interests blend into the quiz interests (candidate selection + scoring); full interpretation stored on `quiz_sessions.answers.interpreted` for Step 5. `recommend.ts` `maxInterests` 3→5 so merged interests are scored. Fully fail-soft.
- **Verified on live vocabulary:** "espresso"→coffee/home & kitchen; "sourdough"→baking/cooking; "no alcohol"→avoid flag; "green thumb"→gardening/indoor plants; etc. 41 unit tests pass.
- **Deployed with 4b** (2026-10-08).

### Step 4b — ✅ on dev/prod-data (2026-10-08, branch `step-4b`, carries 4a)
- **Catalogue AI-tagging** ([ai-tags.ts](src/lib/ai-tags.ts) `tagItem` + `scripts/ai-tag-gifts.ts`, `scripts/ai-tag-products.ts`): maps an item to approved interests (incl. sub-interests), style, gift_type, avoid_flags, primary_interest. **All 64 gifts tagged on prod** (additive — existing tags kept); the 10 coffee items now carry `coffee`. Product tagging is a selective script (cost-controlled; not bulk-run).
- **Budget = ceiling, not band** (owner principle: relevance over price) — [recommend.ts](src/lib/recommend.ts) `withinBudget` + [candidates.ts](src/lib/affiliate/candidates.ts): cheaper relevant items are no longer hidden by a higher budget; `priceFit` kept as a soft in-band nudge.
- `ai-tags.ts` refactored to take the DB client as a param (no `@/` import), so scripts can reuse `tagItem`.
- **Verified:** the coffee quiz now returns coffee gear in the top 3 at every budget (was padding with hydroponics). 41 unit tests pass.
- **Deployed** (master `8fb6603`, ships 4a + 4b). **Step 4 complete.** Next: Step 5 (two-stage recommender + diversity + budget soft-preference polish).

---

## 5. Open questions for you

1. **Tag system:** Are you willing to move to a relational tag model (`tags` + `product_tags` with weights, possibly `ltree` for the interest tree), or should we keep `text[]` columns + a validated vocabulary and layer hierarchy/synonyms on top? (Affects Phase 0 heavily.)
2. **Approval workload:** With feeds this large, do you want to approve **every** product, or auto-approve trusted merchants and only stage new/low-confidence ones?
3. **Scoring philosophy:** When you say the final 3 should be "diverse," what's the default mix — always practical + sentimental + experience/wildcard, or adaptive to the occasion?
4. **Delivery deadlines:** Do we have (or can we derive) reliable **shipping-speed** data per source? Amazon none via API yet; Awin/CJ/Rakuten feeds vary. Without it, "Arrives sooner" can't be a hard filter.
5. **Amazon prices:** Do you currently display any **manually-entered** Amazon price anywhere (articles or quiz)? If so, confirm we should strip it until PA-API is available (post-10-sales).
6. **AI budget/model:** Keep Gemini `2.5-flash` for both tagging and free-text interpretation, or standardize on one model? Expected quiz volume (for cost/rate-limit planning)?
7. **Recipient profiles vs. occasions:** Should recipient profiles be a new first-class table, or an extension of the existing `occasions.recipient_*` fields?
8. **Avoid flags:** What's the initial list you want (no alcohol, minimalist, has-everything, scent-free, no-pork/kosher/halal, etc.)?
9. **Antigravity coexistence:** Several target areas (results page, recommend, quiz) overlap with the other AI tool's territory. Which files should Claude Code own for this work so we don't collide?

---

*Awaiting your review before any implementation. Nothing in the project was modified to produce this report except this file.*
