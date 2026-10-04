-- Affiliate click log (Step 2 of the quiz upgrade, docs/quiz-decisions.md §1).
--
-- Records every outbound click from the quiz results page, tied to its session
-- and the specific pick, plus the network and the sub-tracking value we append
-- to the affiliate URL. This is the baseline data for the learning loop (later
-- steps) and lets a network conversion report be traced back to a quiz.
--
-- Service-role only (no public policies), same pattern as products. Apply on
-- dev/staging first, then production. Safe to re-run.

create table if not exists public.affiliate_clicks (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references public.quiz_sessions(id) on delete cascade,
  suggestion_id uuid references public.gift_suggestions(id) on delete set null,
  source        text,              -- 'gift' | 'product'
  gift_id       uuid,
  product_id    uuid,
  network       text,              -- amazon | awin | cj | rakuten | other
  subtag        text,              -- the value appended (ascsubtag/clickref/sid/u1)
  destination   text,              -- final URL the user was sent to
  created_at    timestamptz not null default now()
);

create index if not exists affiliate_clicks_session_idx on public.affiliate_clicks (session_id);
create index if not exists affiliate_clicks_created_idx on public.affiliate_clicks (created_at);
create index if not exists affiliate_clicks_network_idx on public.affiliate_clicks (network);

alter table public.affiliate_clicks enable row level security;
-- No public policies → only the service role can read/write.
