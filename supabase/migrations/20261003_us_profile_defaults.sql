-- US defaults for NEW profiles (Step 1 / audit R7).
-- KindlyBox is US-focused, but profiles still defaulted to Europe/London + GBP
-- from the initial schema, which mis-schedules reminders and mislabels currency.
--
-- This changes only the column DEFAULTS, so it affects profiles created AFTER
-- this runs. handle_new_user() (migration 20260601) inserts just id/email/name
-- and relies on these defaults, so no function change is needed. Existing rows
-- are intentionally left as-is.
--
-- Apply on dev/staging Supabase first, then production. Safe to re-run.

alter table public.profiles alter column timezone         set default 'America/Chicago';
alter table public.profiles alter column default_currency set default 'USD';
