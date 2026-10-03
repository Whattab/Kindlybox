# KindlyBox Quiz Upgrade — Decisions

**Date:** 2026-10-03
**Owner:** KindlyBox
**Applies to:** the work described in `docs/quiz-audit.md`

This file records the owner's decisions on the audit. **Where this file and `docs/quiz-audit.md` disagree, this file wins.** In particular, it replaces the audit's phase order (section 4) and its tag-system recommendation (Phase 0).

---

## 1. Implementation order (replaces audit section 4)

Work one step at a time. Each step starts in plan mode and waits for owner approval before code is written.

| Step | Work | Notes |
|---|---|---|
| 1 | Quick wins + trusted-merchant safety gate | Fix R5 (filter `in_stock=true`), R2 (remove manually entered Amazon prices; show "See price on Amazon"), R7 (US defaults: `America/Chicago` timezone, `USD` currency for new profiles). Temporary R1 safety: only products from a trusted-merchant allowlist are quiz-eligible until staging exists. |
| 2 | Click tracking + network subtags | Old Phase 4, minus the feedback email. Route all outbound clicks through a tracking redirect for both `gifts` and `products`; write `clicked_at` + session + pick; append quiz path to Amazon tracking ID, CJ SID, Awin `clickref`, Rakuten `u1`. Goal: baseline data before changing the quiz. |
| 3 | Tag taxonomy + staging/approval | Old Phase 0, using the tag design in section 2 below. Nightly sync updates price/stock/image only and never overwrites approved tags. |
| 4 | AI tagging + free-text interpretation | Old Phases 1 and 3 merged: one shared Gemini capability that maps text to approved tags only. Used for feed tagging and for the quiz free-text answer. Keyword matching remains as fallback. |
| 5 | Two-stage recommender + diversity | Old Phase 2. Also fix R4 (pre-filter `gifts` in SQL). |
| 6 | Branching quiz | Old Phase 5, using the question graph in section 4. Ship behind a feature flag so old and new quizzes can be compared and the new one turned off instantly. |
| 7 | Results refinement buttons | Cheaper / More unique / Experience instead / Last-minute ideas, plus per-pick "Not quite" swap. |
| 8 | Recipient profiles + post-occasion feedback | New `recipients` table; "Did they love it?" email + capture table. |

**Holiday caution:** Avoid deploying risky quiz changes between mid-November and December 31 unless they are behind a feature flag.

---

## 2. Tag system (replaces audit Phase 0 recommendation)

Middle path: keep `text[]` columns on products, but store the vocabulary in the database.

- **`tags` table = single source of truth.** Columns: `id`, `slug`, `dimension`, `label`, `path` (Postgres `ltree`, e.g. `outdoors.fishing.fly_fishing`), `active`.
- **Dimensions:** `interest` (3-level tree, max depth 3), `recipient`, `life_stage`, `occasion`, `style`, `gift_type`, `experience_level`, `avoid_flag`.
- **Products keep `text[]` columns** (existing `tags`, `occasions`, `recipients`, plus new `style[]`, `gift_type[]`, `avoid_flags[]`, `experience_level`, and `primary_interest`). Every value must exist in the `tags` table; enforce in sync/approval code and with a database check where practical.
- **Hierarchy without a join table:** when a user selects an interest, expand it to all descendant tags via `ltree`, then match with the existing array-overlap queries and GIN indexes.
- **Tag at the deepest level**; parents are implied.
- **`tag_synonyms` table** (`phrase`, `tag_id`) for free-text interpretation.
- **AI may only choose existing tags.** Proposed new tags go to a review queue, never created automatically.
- **Same tag columns on both `gifts` and `products`.** The recommender reads from one combined view so both catalogues are judged by the same rules.
- A tag should only exist if a quiz question can use it and it changes results. Niche tags with fewer than ~10 approved products are merged into their parent until more products exist.

---

## 3. Answers to the audit's open questions

1. **Tag system:** Section 2 above.
2. **Approval workload:** Auto-approve products from trusted merchants when AI tag confidence is high. Stage new merchants and low-confidence products for owner review. Owner spot-checks a sample of auto-approved items weekly. Maintain a keyword blocklist (political, offensive, medical-claim, and other off-brand products). Trusted-merchant list: **to be provided by owner.**
3. **Diversity:** Adaptive. Default mix: practical + sentimental + experience/wildcard. If the user picks a gift feel, 2 of 3 picks match it and 1 is a wildcard. Sympathy occasions never include fun/quirky items.
4. **Delivery deadlines:** No "Arrives sooner" hard filter yet (shipping data unreliable). Replace with a "Last-minute ideas" option (digital gifts, e-gift cards, experiences).
5. **Amazon prices:** Remove all manually entered Amazon prices everywhere; show "See price on Amazon" until Product Advertising API access is available.
6. **AI model:** Keep Gemini `2.5-flash` for tagging, free-text interpretation, and "why" notes.
7. **Recipient profiles:** New first-class `recipients` table; `occasions` link to it via `recipient_id`. Keep existing `occasions.recipient_*` fields during transition.
8. **Initial avoid flags:** no alcohol, minimalist/no clutter, has everything, scent-sensitive, dietary needs, not into tech. Religious dietary flags only when products can be tagged reliably.
9. **Tool ownership:** See section 5.

---

## 4. Branching question graph (for Step 6)

Target: 5–7 screens for most users. Questions are defined as data (a decision graph), not hardcoded steps. URL prefill from reminder emails must keep working.

**S1 — Who + life stage (one screen)**
- Relationship: partner, mom, dad, friend, sibling, grandparent, child, coworker/boss, someone else.
- Life-stage chips appear on the same screen: child → baby / toddler / kid / tween / teen; adult → 20s / 30s-40s / 50s-60s / 70+.
- Rules: child → exclude alcohol, romance, luxe. Coworker → exclude intimate items; favor practical/treat.

**S2 — Occasion (options depend on S1)**
- birthday, holidays, thank you, housewarming, retirement, wedding, new baby, sympathy, just because.
- Anniversary / Valentine's only if S1 = partner. Graduation only if teen, 20s, or child.
- Rule: sympathy → exclude fun/quirky; skip S3–S4 depth.

**S3 — "How do they spend a free Saturday?" (picture choices, up to 2)**
- outdoors, in the kitchen, relaxing at home, with gadgets, making/creating, staying active, reading/learning, hosting friends, traveling, with their pets.

**S4 — Depth (only for S3 choices whose branch has 10+ approved products)**
- outdoors → fishing / hiking / camping / gardening / golf
- kitchen → cooking / baking / coffee / grilling / wine & cocktails
- gadgets → smart home / audio / gaming / photography
- Then, only for hobby branches where level matters: "How into it are they?" → just starting / enthusiast / has all the gear.
- Rule: "has all the gear" → favor premium upgrades, consumables, experiences.

**S5 — Gift feel**
- practical, sentimental, a treat they wouldn't buy themselves, fun, an experience, surprise me.
- Rules: see diversity decision (section 3, item 3).

**S6 — Budget + avoids (one screen)**
- Budget bands, then optional avoid chips (section 3, item 8).

**S7 — Optional free text**
- "Tell us one thing about them" → AI maps to approved tags only.

**Conditional**
- "When do you need it?" appears only if the occasion is within 7 days AND reliable shipping data exists. Otherwise offer "Last-minute ideas" on results.

**Removed / moved**
- Gender: no standalone question; ask only inside branches where it matters (apparel, some beauty).
- Email capture: move from the quiz to the results page ("Email me these picks").

---

## 5. Tool ownership

Claude Code owns these areas for this project:
- `src/components/quiz/`, `src/app/quiz/`
- `src/lib/recommend.ts`, `src/lib/personalize.ts`
- `src/app/results/`
- `src/lib/affiliate/`, `src/app/go/`
- `src/app/api/quiz/`, `src/app/api/cron/affiliate-sync/`
- New Supabase migrations for this project

Antigravity stays on the articles/content pipeline (`src/lib/intelligence/`, blog/article code). The two tools must not work on the same branch at the same time.

---

## 6. Engineering rules for this project

- Start every step in plan mode; wait for owner approval before writing code.
- Do not change anything outside the current step's scope.
- Run `tsc --noEmit` and the test suite before every commit (builds currently ignore type errors, so this check is required).
- Database changes only via new migration files, tested on local or development Supabase, never production first.
- Secrets stay in environment variables; never commit keys.
- After each step: summarize changes, explain how to test, and update `docs/quiz-audit.md` to mark the step complete.
- Compliance: no manually entered Amazon prices; Amazon images only via SiteStripe or the API; keep affiliate disclosures; no unverified ratings, review counts, or testimonials.
