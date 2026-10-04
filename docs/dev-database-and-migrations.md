# Dev database & migration workflow

**Why:** schema changes get tested on a throwaway **dev** database before they touch
**production**, so a bad migration never hits live data. This makes real the rule in
`quiz-decisions.md` §6 ("DB changes only via new migration files, tested on dev Supabase,
never production first").

---

## One-time: create the free dev project

The Supabase free tier allows **two active free projects**, so a dedicated dev DB is $0.

1. supabase.com/dashboard → **New project**
   - Name: `kindlybox-dev`
   - Set a strong **database password** (save it in your password manager)
   - Region: same as prod (or nearest to you)
2. Wait ~2 min for provisioning.
3. **Settings → API** → copy the dev project's **Project URL**, **anon key**, and
   **service_role key**. You'll use these when testing the app/scripts against dev.
4. **Mirror the schema onto dev:** open dev's **SQL Editor** and run every file in
   `supabase/migrations/` once, in filename order. They're written to be idempotent, so
   re-running is safe. (Or use the Supabase CLI — see bottom.)
5. *(Optional)* seed some data to test against: run `node seed-gifts.js` pointed at dev,
   or copy a subset of prod rows (e.g. a few hundred `products`) with `pg_dump --table` →
   restore into dev.

---

## Per-migration workflow (Step 3 onward)

For every new file added to `supabase/migrations/`:

1. **Dev first** — paste the SQL into the **dev** project's SQL Editor → **Run**. Verify:
   query the new objects, and if relevant, run the app against dev (see below).
2. **Then prod** — paste the **same** SQL into the **prod** project's SQL Editor → **Run**.
3. The migration `.sql` file is committed to the repo (already the practice).

Keep migrations **idempotent** (`create table if not exists`, `alter … set default`,
guarded `do $$ … $$` for policies/constraints) so a re-run never errors.

---

## Running the app/scripts against dev

Temporarily point the env vars at dev, then switch back:

1. `cp .env.local .env.local.prod-backup`
2. In `.env.local`, replace these three with the **dev** project's values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. `npm run dev` / run your `tsx` scripts — they now hit dev.
4. When done: `mv .env.local.prod-backup .env.local` (restore prod values).

`.env.local*` is gitignored — never commit either file.

---

## Backups (free tier has no one-click download)

- **Full:** `pg_dump "<URI from Settings → Database>" > backup-YYYY-MM-DD.sql`
  (use the **Session pooler** URI if the direct host is IPv6-only;
  `supabase db dump --db-url "<URI>" -f backup.sql` also works).
- **Targeted (for additive migrations):** keep the reverse SQL in the migration's PR/notes
  instead of a full dump — faster and sufficient when nothing existing is modified.

---

## Optional: Supabase CLI (nicer long-term)

Install the CLI, then per environment:
`supabase link --project-ref <ref>` → `supabase db push` applies `supabase/migrations/`
to the linked project. Flow: link **dev** → push → verify → link **prod** → push.

> Caveat: the early migrations here were hand-run in the SQL Editor and aren't recorded in
> Supabase's migration history, so `db push` may try to re-apply them. Since they're
> idempotent this is usually fine, but if `db push` errors on an existing object, just
> apply new migrations individually via the SQL Editor (the per-migration workflow above).

---

## Current state (2026-10-04)

- Prod is the only project so far. These two were run **directly on prod** by explicit
  owner decision (additive + low-risk, no dev project existed yet):
  `20261003_us_profile_defaults.sql`, `20261003_affiliate_clicks.sql`.
- From **Step 3 onward**, follow the dev-first workflow above.
