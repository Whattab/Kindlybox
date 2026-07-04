-- Let buyers attach photos (a person, place, pet, etc.) to include in their
-- greeting card. Stored as an array of public Storage URLs on the order.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.orders
  add column if not exists reference_photos text[];
