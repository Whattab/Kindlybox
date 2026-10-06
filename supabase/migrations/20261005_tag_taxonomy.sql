-- Tag taxonomy (Step 3a of the quiz upgrade, quiz-decisions.md §2).
--
-- The single source of truth for the quiz vocabulary. `tags` holds every
-- dimension's values; the `interest` dimension is hierarchical via Postgres
-- ltree (so a chosen interest can later expand to its sub-interests).
-- `tag_synonyms` maps free-text phrases to a tag, for Step 4's interpretation.
--
-- `label` is the exact string already stored in gifts.tags / products.tags, so
-- the catalogue needs no rewrite — this table just maps those labels to a path.
--
-- Nothing reads these tables yet (data layer only). Apply on dev first, then
-- prod. Safe to re-run.

create extension if not exists ltree;

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,        -- ltree-safe id, e.g. 'home_kitchen'
  dimension  text not null,               -- interest|recipient|life_stage|occasion|style|gift_type|experience_level|avoid_flag
  label      text not null,               -- value stored in gifts/products arrays, e.g. 'home & kitchen'
  path       ltree not null,              -- 'home_kitchen.coffee' (interest); flat dims = just the slug
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (dimension, label)
);
create index if not exists tags_path_gist on public.tags using gist (path);
create index if not exists tags_dim_idx    on public.tags (dimension);

create table if not exists public.tag_synonyms (
  id         uuid primary key default gen_random_uuid(),
  phrase     text not null,               -- lowercased free-text phrase
  tag_id     uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (phrase, tag_id)
);
create index if not exists tag_synonyms_phrase_idx on public.tag_synonyms (lower(phrase));

alter table public.tags         enable row level security;
alter table public.tag_synonyms enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tags' and policyname='Tags are publicly readable') then
    create policy "Tags are publicly readable" on public.tags for select to anon, authenticated using (active);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tag_synonyms' and policyname='Synonyms are publicly readable') then
    create policy "Synonyms are publicly readable" on public.tag_synonyms for select to anon, authenticated using (true);
  end if;
end$$;
-- Writes go through the service role only (no write policies).
