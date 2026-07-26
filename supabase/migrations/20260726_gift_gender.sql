-- Gender targeting for gifts.
--
-- The quiz asks the recipient's gender (male / female / unknown) separately
-- from the relationship (him, her, parent, friend, ...). Relationship alone
-- can't express "this is a men's item" — a men's polo is a fine gift for a
-- friend or sibling who happens to be male. So gifts carry their own gender.
--
-- A gift is 'unisex' by default; mark 'male' or 'female' only for clearly
-- gendered items. The recommender excludes gifts marked for the opposite of
-- the quiz's gender answer (unisex always allowed; "unknown" applies no
-- filter). Run in the Supabase SQL editor. Safe to re-run.

alter table public.gifts
  add column if not exists gender text not null default 'unisex';

-- Existing rows: the column default already backfills them to 'unisex'.

-- Only allow the three known values.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gifts_gender_check') then
    alter table public.gifts
      add constraint gifts_gender_check check (gender in ('male', 'female', 'unisex'));
  end if;
end $$;
