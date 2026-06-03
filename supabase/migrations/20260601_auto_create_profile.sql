-- Auto-create a profiles row whenever a new auth.users row appears.
-- Run this in Supabase SQL Editor.
-- Idempotent — safe to re-run.

-- =============================================================================
-- 1. Function: creates a profile from the new auth user's metadata
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;   -- safety: if a row already exists, no-op
  return new;
end;
$$;

-- =============================================================================
-- 2. Trigger: fires after each new auth user
-- =============================================================================
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- 3. Backfill: create profile rows for any existing auth users that don't have one
--    (Unblocks the test users you created before this trigger existed.)
-- =============================================================================
insert into public.profiles (id, email, first_name, full_name)
select
  au.id,
  au.email,
  au.raw_user_meta_data->>'first_name',
  au.raw_user_meta_data->>'full_name'
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;

-- =============================================================================
-- 4. Sanity check (uncomment to run after applying):
-- =============================================================================
-- select count(*) as auth_users_count from auth.users;
-- select count(*) as profiles_count from public.profiles;
-- These two numbers should match.
