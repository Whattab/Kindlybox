-- Product staging & approval (Step 3c, quiz-decisions.md §1 + §3.2).
--
-- Adds a review status to products and surfaces it through the catalogue view.
-- Existing rows default 'approved' (no disruption); the nightly sync assigns
-- status to new rows, and an admin review queue approves/rejects staged ones.
-- Apply on dev first, then prod (before the matching code deploy). Safe to re-run.

alter table public.products
  add column if not exists status text not null default 'approved';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_status_check') then
    alter table public.products add constraint products_status_check
      check (status in ('staged','approved','rejected'));
  end if;
end$$;

create index if not exists products_status_idx on public.products (status);

-- Re-create the catalogue view to expose status (gifts are always 'approved').
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
    true as in_stock,
    'approved'::text as status
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
    p.in_stock,
    p.status
  from public.products p
  where p.active;
