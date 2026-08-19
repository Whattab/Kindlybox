-- ============================================================================
-- KindlyBox Gift Intelligence Engine — Phase 2: articles
-- ----------------------------------------------------------------------------
-- Turns an APPROVED content opportunity into a real, publishable article.
--
-- One table: `articles`. Unlike the Phase 1 tables (which are admin-only), this
-- one is READ-PUBLIC for published rows — the public /blog pages read it with
-- the anon key. Drafts stay invisible until you publish them.
-- ============================================================================

create table if not exists public.articles (
  id                 uuid primary key default gen_random_uuid(),
  -- Where this article came from. Kept so the dashboard can show the score and
  -- "why now" that justified writing it; set null if the opportunity is purged.
  opportunity_id     uuid references public.content_opportunities(id) on delete set null,

  slug               text not null unique,   -- /blog/<slug>
  title              text not null,
  meta_description   text,                   -- <meta name="description">
  excerpt            text,                   -- card blurb on /blog
  -- Markdown prose. May contain the literal token {{products}} — the article
  -- page renders the product cards at exactly that spot.
  body               text not null default '',
  hero_image_url     text,

  content_type       text,                   -- gift_guide | listicle | how_to | comparison
  primary_keyword    text,
  secondary_keywords text[] default '{}',

  -- The real catalog products this article recommends, in display order:
  -- [{gift_id, name, slug, image_url, price_min, price_max, heading, blurb}]
  product_blocks     jsonb not null default '[]',

  status             text not null default 'DRAFT'
                       check (status in ('DRAFT','REVIEW','PUBLISHED','ARCHIVED')),

  generated_by       text,                   -- model id, or 'template' when AI was unavailable
  generated_at       timestamptz,
  author             text,                   -- admin email that published it
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists articles_status_idx    on public.articles (status);
create index if not exists articles_published_idx on public.articles (published_at desc);
create index if not exists articles_opp_idx       on public.articles (opportunity_id);

-- RLS: anyone may read PUBLISHED articles; nobody may write.
-- All writes go through the service role (which bypasses RLS), same as orders.
alter table public.articles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'articles'
       and policyname = 'Published articles are publicly readable'
  ) then
    create policy "Published articles are publicly readable"
      on public.articles for select
      to anon, authenticated
      using (status = 'PUBLISHED');
  end if;
end$$;
