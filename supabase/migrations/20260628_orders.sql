-- Paid extras: custom songs + greeting cards (and bundles).
-- Manual-fulfillment v1: a buyer pays, submits a brief, and an admin
-- generates + delivers the assets. Run in Supabase SQL Editor. Safe to re-run.

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  user_id uuid references public.profiles(id), -- null for anonymous buyers

  -- Who to deliver to
  buyer_email text not null,
  buyer_name text,

  -- What they bought
  service_type text not null,        -- 'song' | 'card' | 'bundle'
  occasion text,                     -- birthday, wedding, anniversary, ...
  recipient_name text,

  -- The brief (their inputs)
  card_message text,                 -- the exact words for the card
  song_details text,                 -- style/mood/story for the song

  -- Money
  price_cents int not null,
  currency text not null default 'usd',

  -- Lifecycle
  status text not null default 'pending_payment',
    -- pending_payment | paid | in_progress | delivered | cancelled
  stripe_session_id text,
  stripe_payment_intent text,

  -- Fulfillment outputs
  song_url text,
  card_url text,
  admin_notes text,
  delivered_at timestamptz
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Orders hold buyer PII + private messages. Lock the table down: enable RLS
-- with NO policies, so the anon/public key cannot read or write it. All access
-- goes through server code using the service-role key, which bypasses RLS.
alter table public.orders enable row level security;
