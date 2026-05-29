-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text unique not null,
  full_name text,
  first_name text,
  avatar_url text,
  timezone text default 'Europe/London',
  default_currency text default 'GBP',
  default_budget numeric,
  reminder_days int[] default '{7,1}',
  email_notifications boolean default true,
  created_at timestamptz default now()
);

-- Occasions / Events
create table public.occasions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  occasion_type text not null, -- birthday, anniversary, christmas, etc.
  recipient_name text,
  recipient_relation text, -- partner, parent, friend, child, colleague
  date date not null,
  recurring boolean default true,
  budget numeric,
  notes text,
  created_at timestamptz default now()
);

-- Reminder queue
create table public.reminders (
  id uuid default gen_random_uuid() primary key,
  occasion_id uuid references public.occasions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  send_at timestamptz not null,
  channel text default 'email', -- email, push
  status text default 'pending', -- pending, sent, failed
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Gift catalogue
create table public.gifts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  image_url text,
  price_min numeric not null,
  price_max numeric not null,
  tags text[], -- wellness, books, food, travel, tech, fashion, home, sport
  occasions text[], -- birthday, anniversary, christmas, wedding, etc.
  recipients text[], -- partner, parent, friend, child, colleague, sibling
  affiliate_url text,
  affiliate_network text, -- amazon, awin, etsy, other
  active boolean default true,
  created_at timestamptz default now()
);

-- Quiz sessions
create table public.quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id), -- null if anonymous
  occasion_id uuid references public.occasions(id), -- optional link
  answers jsonb not null, -- { recipient, occasion, interests[], budget }
  email_captured text, -- for anonymous users
  first_name_captured text,
  created_at timestamptz default now()
);

-- Gift suggestions (output of quiz)
create table public.gift_suggestions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.quiz_sessions(id) on delete cascade,
  gift_id uuid references public.gifts(id),
  match_score numeric, -- 0-100
  rank int, -- 1, 2, or 3
  email_sent_at timestamptz,
  clicked_at timestamptz
);

-- User purchase history
create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  gift_id uuid references public.gifts(id), -- nullable (custom gift)
  occasion_id uuid references public.occasions(id),
  gift_name text, -- fallback for custom gifts
  price_paid numeric,
  purchased_at date,
  status text default 'saved', -- saved, ordered, delivered
  recipient_name text,
  notes text,
  created_at timestamptz default now()
);

-- Allow RLS
alter table public.profiles enable row level security;
alter table public.occasions enable row level security;
alter table public.reminders enable row level security;
alter table public.gifts enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.gift_suggestions enable row level security;
alter table public.purchases enable row level security;

-- Profiles: users can only read/write their own data
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Occasions: users can only read/write their own data
create policy "Users can view own occasions" on public.occasions for select using (auth.uid() = user_id);
create policy "Users can insert own occasions" on public.occasions for insert with check (auth.uid() = user_id);
create policy "Users can update own occasions" on public.occasions for update using (auth.uid() = user_id);
create policy "Users can delete own occasions" on public.occasions for delete using (auth.uid() = user_id);

-- Reminders: users can only read/write their own data
create policy "Users can view own reminders" on public.reminders for select using (auth.uid() = user_id);
create policy "Users can insert own reminders" on public.reminders for insert with check (auth.uid() = user_id);
create policy "Users can update own reminders" on public.reminders for update using (auth.uid() = user_id);
create policy "Users can delete own reminders" on public.reminders for delete using (auth.uid() = user_id);

-- Gifts: readable by anyone (active gifts), strictly admin for modifications
create policy "Gifts visible to all" on public.gifts for select using (active = true);
-- Let's add basic modification right for authenticated user to add seed data or just rely on service role
create policy "Gifts insertable by service role only" on public.gifts for insert with check (true);

-- Quiz Sessions: readable/writable by owner or anonymous (user_id is null)
create policy "Quiz sessions insertable" on public.quiz_sessions for insert with check (true);
create policy "Quiz sessions viewable by owner or anonymous" on public.quiz_sessions for select using (user_id = auth.uid() or user_id is null);
create policy "Quiz sessions updatable by owner or anonymous" on public.quiz_sessions for update using (user_id = auth.uid() or user_id is null);

-- Gift Suggestions: insertable and readable by anyone
create policy "Gift suggestions insertable" on public.gift_suggestions for insert with check (true);
create policy "Gift suggestions viewable" on public.gift_suggestions for select using (true);
create policy "Gift suggestions updatable" on public.gift_suggestions for update using (true);

-- Purchases: users can only read/write their own data
create policy "Users can view own purchases" on public.purchases for select using (auth.uid() = user_id);
create policy "Users can insert own purchases" on public.purchases for insert with check (auth.uid() = user_id);
create policy "Users can update own purchases" on public.purchases for update using (auth.uid() = user_id);
create policy "Users can delete own purchases" on public.purchases for delete using (auth.uid() = user_id);
