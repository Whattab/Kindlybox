-- Group gifting ("Gift together", option 1 — no money handled by KindlyBox).
--
-- An organiser turns a quiz result into a shareable group page. Friends open
-- the link, vote for one of the picks and tap "I'm in"; the page splits the
-- total and shows the organiser's Venmo / PayPal / Cash App so people pay them
-- back directly. The organiser buys through our tracked /go/s/<id> link.
--
-- Service-role only (no public policies), same pattern as affiliate_clicks:
-- the app reads/writes through the service client on the server. Apply on dev
-- first, then production. Safe to re-run.

create table if not exists public.group_gifts (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.quiz_sessions(id) on delete cascade,
  manage_key           text not null,          -- secret; whoever holds it is the organiser
  organiser_name       text not null,
  note                 text,
  pay_venmo            text,                   -- handle only, no @
  pay_paypal           text,                   -- paypal.me handle
  pay_cashapp          text,                   -- cashtag, no $
  chosen_suggestion_id uuid references public.gift_suggestions(id) on delete set null,
  total_amount         numeric(10,2),          -- typed by the organiser (Amazon prices are never stored by us)
  created_at           timestamptz not null default now()
);

create index if not exists group_gifts_session_idx on public.group_gifts (session_id);

create table if not exists public.group_gift_members (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references public.group_gifts(id) on delete cascade,
  name               text not null,
  vote_suggestion_id uuid references public.gift_suggestions(id) on delete set null,
  is_organiser       boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists group_gift_members_group_idx on public.group_gift_members (group_id);

alter table public.group_gifts enable row level security;
alter table public.group_gift_members enable row level security;
-- No public policies → only the service role can read/write.
