-- Group gifting: link a group to the organiser's KindlyBox account so they can
-- sign in from any device and find it under Dashboard → Group Gifts.
--
-- organiser_user_id is set when a signed-in organiser creates a group, or the
-- first time the organiser's browser opens it (or the dashboard) while signed
-- in. organiser_email / link_emails_sent back the "Email me my organiser link"
-- option for organisers who never sign in (capped per group).
--
-- Service-role only, as before. Apply on dev first, then production. Safe to re-run.

alter table public.group_gifts
  add column if not exists organiser_user_id uuid references auth.users(id) on delete set null,
  add column if not exists organiser_email   text,
  add column if not exists link_emails_sent  integer not null default 0;

create index if not exists group_gifts_organiser_idx on public.group_gifts (organiser_user_id);
