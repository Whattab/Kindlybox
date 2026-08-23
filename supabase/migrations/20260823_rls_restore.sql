-- ============================================================================
-- SECURITY: restore row-level security on the original (March) tables
-- ----------------------------------------------------------------------------
-- RLS was switched off on these seven tables at some point during development,
-- so the ANON key — which ships inside every visitor's browser — could read,
-- edit and delete them. Verified before writing this: the anon key could read
-- all 130 quiz_sessions (including captured emails), all 14 profiles, and could
-- delete a row from gifts.
--
-- Tables added later (orders, articles, and the intelligence engine) already
-- enforce RLS correctly and are untouched here.
--
-- RUN THIS ONLY AFTER the matching deploy is live: the catalogue, leads and
-- results pages had to move to the service client first, or they break the
-- moment RLS comes back on.
--
-- Safe to re-run.
-- ============================================================================

-- 1. Turn RLS back on. The owner-scoped policies for profiles, occasions,
--    reminders and purchases already exist from the initial schema and are
--    correct — they simply weren't being enforced.
alter table public.profiles         enable row level security;
alter table public.occasions        enable row level security;
alter table public.reminders        enable row level security;
alter table public.purchases        enable row level security;
alter table public.gifts            enable row level security;
alter table public.quiz_sessions    enable row level security;
alter table public.gift_suggestions enable row level security;

-- 2. GIFTS ------------------------------------------------------------------
-- Public may read live gifts only. The dashboard writes with the service role,
-- so no public write policy is needed. The old insert policy was named "service
-- role only" but its check was `true`, i.e. it let ANY caller insert gifts.
drop policy if exists "Gifts insertable by service role only" on public.gifts;
drop policy if exists "Gifts visible to all" on public.gifts;

create policy "Live gifts are publicly readable"
  on public.gifts for select
  to anon, authenticated
  using (active = true);

-- 3. QUIZ SESSIONS ----------------------------------------------------------
-- These hold captured emails and names, so they are no longer world-readable.
-- The quiz API writes them with the service role, and the results page reads
-- them with the service role (server-side only), so shoppers who never sign in
-- still see their results — the session id in the URL is an unguessable UUID.
-- Signed-in users keep direct access to their own sessions.
drop policy if exists "Quiz sessions insertable" on public.quiz_sessions;
drop policy if exists "Quiz sessions viewable by owner or anonymous" on public.quiz_sessions;
drop policy if exists "Quiz sessions updatable by owner or anonymous" on public.quiz_sessions;

create policy "Users can view their own quiz sessions"
  on public.quiz_sessions for select
  to authenticated
  using (user_id = auth.uid());

-- 4. GIFT SUGGESTIONS -------------------------------------------------------
-- Written by the quiz API (service role) and read by the results page (service
-- role). Signed-in users can read the suggestions belonging to their own
-- sessions; nobody else can enumerate them.
drop policy if exists "Gift suggestions insertable" on public.gift_suggestions;
drop policy if exists "Gift suggestions viewable" on public.gift_suggestions;
drop policy if exists "Gift suggestions updatable" on public.gift_suggestions;

create policy "Users can view suggestions for their own sessions"
  on public.gift_suggestions for select
  to authenticated
  using (
    exists (
      select 1 from public.quiz_sessions s
       where s.id = gift_suggestions.session_id
         and s.user_id = auth.uid()
    )
  );
