-- ============================================================================
-- KindlyBox Gift Intelligence Engine — Phase 1 foundation
-- ----------------------------------------------------------------------------
-- Four tables:
--   trend_sources        catalog of where signals come from (pluggable adapters)
--   gift_trends          discovered trends WITH their evidence + confidence
--   content_opportunities scored, "why-now"-justified article opportunities
--   scoring_weights      tunable weights so the formula changes without code
--
-- All admin-only: RLS is enabled with NO public policies, so anon/authenticated
-- users get nothing. The app reads/writes these exclusively via the service
-- role (which bypasses RLS), same pattern as `orders`.
-- ============================================================================

-- 1. TREND SOURCES ----------------------------------------------------------
create table if not exists public.trend_sources (
  id           uuid primary key default gen_random_uuid(),
  source_name  text not null,                 -- "Google Trends"
  source_type  text not null,                 -- search | social | retail | news | calendar | first_party
  category     text,                          -- "Search Trends"
  endpoint     text,                          -- URL / API base (nullable)
  config       jsonb not null default '{}',   -- per-source params (keywords, subreddits, feed urls…)
  active       boolean not null default true,
  last_checked timestamptz,
  last_status  text,                          -- ok | error | never
  last_note    text,                          -- last run message / error detail
  created_at   timestamptz not null default now()
);

-- 2. GIFT TRENDS ------------------------------------------------------------
-- The engine stores not just the trend, but the EVIDENCE behind it, so we can
-- always tell "genuinely rising" (measured) from "AI thinks so" (ai_estimated).
create table if not exists public.gift_trends (
  id                uuid primary key default gen_random_uuid(),
  trend_name        text not null,
  category          text,
  search_volume     numeric,                  -- relative or absolute, per source
  growth_rate       numeric,                  -- percent change
  trend_direction   text,                     -- new | rising | hot | steady | declining
  source_id         uuid references public.trend_sources(id) on delete set null,
  source            text,                     -- denormalized source name for quick display
  source_url        text,
  provenance        text not null default 'measured',  -- measured | ai_estimated | manual
  confidence        numeric not null default 0.5,      -- 0..1
  seasonality       text,                     -- e.g. "peaks: mothers_day, christmas"
  related_keywords  text[] default '{}',
  related_products  jsonb not null default '[]',       -- [{gift_id, name}]
  evidence          jsonb not null default '{}',       -- raw supporting payload from the source
  first_detected    timestamptz not null default now(),
  last_updated      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (trend_name, source_id)              -- upsert target: one row per trend per source
);

create index if not exists gift_trends_direction_idx on public.gift_trends (trend_direction);
create index if not exists gift_trends_updated_idx   on public.gift_trends (last_updated desc);

-- 3. CONTENT OPPORTUNITIES --------------------------------------------------
-- The content command center. Every row is a scored, justified article idea.
create table if not exists public.content_opportunities (
  id                   uuid primary key default gen_random_uuid(),
  topic                text not null,
  suggested_title      text,
  content_type         text,                  -- gift_guide | listicle | how_to | comparison …
  primary_keyword      text,
  secondary_keywords   text[] default '{}',

  -- Factor scores, each 0..100
  search_score         int,
  growth_score         int,
  competition_score    int,
  affiliate_score      int,
  seasonal_score       int,
  kindlybox_score      int,
  freshness_score      int,
  overall_score        int,
  -- Full breakdown incl. the weights used and per-factor provenance
  score_breakdown      jsonb not null default '{}',

  why_now              text not null,         -- MANDATORY: why publish this now
  recommended_products jsonb not null default '[]',   -- [{gift_id, name, affiliate_url}]
  recommended_links    jsonb not null default '[]',   -- internal links [{href, label}]

  trend_id             uuid references public.gift_trends(id) on delete set null,
  status               text not null default 'DISCOVERED'
                         check (status in ('DISCOVERED','ANALYZING','RECOMMENDED','APPROVED',
                                           'WRITING','REVIEW','PUBLISHED','UPDATE_REQUIRED','ARCHIVED')),
  approved_by          text,
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists content_opps_status_idx on public.content_opportunities (status);
create index if not exists content_opps_score_idx  on public.content_opportunities (overall_score desc);

-- 4. SCORING WEIGHTS --------------------------------------------------------
-- One row per factor. Tune the formula from the DB, no deploy needed.
create table if not exists public.scoring_weights (
  factor     text primary key,               -- search | growth | competition | affiliate | seasonal | kindlybox | freshness
  weight     numeric not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.scoring_weights (factor, weight) values
  ('search',     1.5),
  ('growth',     1.5),
  ('seasonal',   1.3),
  ('kindlybox',  1.4),   -- first-party demand weighted high on purpose
  ('affiliate',  1.0),
  ('competition',1.0),
  ('freshness',  0.8)
on conflict (factor) do nothing;

-- 5. SEED THE INITIAL SOURCES ----------------------------------------------
-- Active = the free/reliable tier we build first. Inactive = gated/paid, wired later.
insert into public.trend_sources (source_name, source_type, category, endpoint, active, config) values
  ('Holiday & Occasion Calendar', 'calendar',    'Seasonality',    null, true,  '{}'),
  ('Google Trends',               'search',      'Search Trends',  'https://trends.google.com', true, '{"geo":"US"}'),
  ('Reddit',                      'social',      'Discussions',    'https://oauth.reddit.com', false, '{"subreddits":["GiftIdeas","gifts"]}'),
  ('Gift Industry News (RSS)',    'news',        'Industry News',  null, false, '{"feeds":[]}'),
  ('KindlyBox Quiz Data',         'first_party', 'First-Party',    null, true,  '{}'),
  ('KindlyBox Website Analytics', 'first_party', 'First-Party',    null, false, '{}'),
  ('Google Shopping',             'retail',      'Product Trends', null, false, '{"needs":"paid_api"}'),
  ('Amazon Product Trends',       'retail',      'Product Trends', null, false, '{"needs":"associate_api"}'),
  ('Etsy Trends',                 'retail',      'Product Trends', null, false, '{"needs":"etsy_api"}'),
  ('Pinterest Trends',            'social',      'Social Trends',  null, false, '{"needs":"paid_api"}'),
  ('TikTok Trends',               'social',      'Social Trends',  null, false, '{"needs":"paid_scraper"}')
on conflict do nothing;

-- 6. RLS: lock everything to the service role -------------------------------
alter table public.trend_sources          enable row level security;
alter table public.gift_trends            enable row level security;
alter table public.content_opportunities  enable row level security;
alter table public.scoring_weights        enable row level security;
-- No policies added on purpose → only the service role (bypasses RLS) can touch these.
