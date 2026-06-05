-- Adds the columns the /go/[slug] redirect handler needs.
-- Run this in Supabase SQL Editor. Safe to re-run.
--
--   slug             — used by the redirect handler to look up the gift
--   destination_url  — the real product URL we redirect to
--                      (eventually with affiliate tag appended)

alter table public.gifts
  add column if not exists slug text;

alter table public.gifts
  add column if not exists destination_url text;

-- Make slug unique (we look up gifts by slug)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gifts_slug_key'
  ) then
    alter table public.gifts
      add constraint gifts_slug_key unique (slug);
  end if;
end$$;

-- Backfill slug from any existing affiliate_url that already contains /go/<slug>
update public.gifts
   set slug = regexp_replace(affiliate_url, '^.*/go/', '')
 where slug is null
   and affiliate_url is not null
   and affiliate_url like '%/go/%';

-- Fast lookup by slug
create index if not exists gifts_slug_idx on public.gifts(slug);
