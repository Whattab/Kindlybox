-- Catalogue tag columns + combined view (Step 3b, quiz-decisions.md §2).
--
-- Adds the new taxonomy dimensions to BOTH products and gifts so each row can
-- carry them (filled by Step 4's tagging), and creates one `catalogue` view that
-- unifies the two tables for the Step 5 recommender. Columns start empty;
-- nothing reads the view yet. Apply on dev first, then prod. Safe to re-run.

-- 1. New columns on products -------------------------------------------------
alter table public.products
  add column if not exists style            text[] not null default '{}',
  add column if not exists gift_type        text[] not null default '{}',
  add column if not exists avoid_flags      text[] not null default '{}',
  add column if not exists experience_level text,
  add column if not exists primary_interest text;

-- 2. Same columns on gifts ---------------------------------------------------
alter table public.gifts
  add column if not exists style            text[] not null default '{}',
  add column if not exists gift_type        text[] not null default '{}',
  add column if not exists avoid_flags      text[] not null default '{}',
  add column if not exists experience_level text,
  add column if not exists primary_interest text;

-- 3. Cheap static guard: experience_level is one taxonomy value --------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_xp_check') then
    alter table public.products add constraint products_xp_check
      check (experience_level is null or experience_level in ('beginner','enthusiast','expert'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gifts_xp_check') then
    alter table public.gifts add constraint gifts_xp_check
      check (experience_level is null or experience_level in ('beginner','enthusiast','expert'));
  end if;
end$$;

-- 4. Indexes for the array columns we'll filter on (products ~11k) -----------
create index if not exists products_style_idx      on public.products using gin (style);
create index if not exists products_gift_type_idx   on public.products using gin (gift_type);
create index if not exists products_avoid_flags_idx on public.products using gin (avoid_flags);
create index if not exists products_primary_int_idx on public.products (primary_interest);

-- 5. Combined view the recommender will read (Step 5) ------------------------
-- security_invoker = true → the view runs with the QUERYING role's RLS, so anon
-- sees only public gifts (products RLS returns nothing) while the service role
-- (the recommender) sees everything. No product data leaks through the view.
create or replace view public.catalogue
  with (security_invoker = true) as
  select
    'gift'::text as source,
    g.id, g.name, g.description, g.image_url,
    g.price_min, g.price_max,
    g.tags, g.occasions, g.recipients, g.gender,
    g.style, g.gift_type, g.avoid_flags, g.experience_level, g.primary_interest,
    g.affiliate_network as network,
    coalesce(g.destination_url, g.affiliate_url) as affiliate_link,
    true as in_stock
  from public.gifts g
  where g.active
  union all
  select
    'product'::text as source,
    p.id, p.title as name, p.description, p.image_url,
    p.price as price_min, p.price as price_max,
    p.tags, p.occasions, p.recipients, p.gender,
    p.style, p.gift_type, p.avoid_flags, p.experience_level, p.primary_interest,
    p.network,
    p.affiliate_link,
    p.in_stock
  from public.products p
  where p.active;
