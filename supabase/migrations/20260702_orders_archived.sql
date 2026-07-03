-- Add an "archived" flag so fulfilled/old orders can be hidden from the active
-- list without being deleted. Run in Supabase SQL Editor. Safe to re-run.

alter table public.orders
  add column if not exists archived boolean not null default false;

create index if not exists orders_archived_idx on public.orders (archived);
