-- ============================================================================
-- Affiliate product ingestion — the unified product database.
-- One normalized shape for every network (Awin now; CJ/Rakuten later just write
-- the same rows). Admin/service-role only, same RLS pattern as orders.
-- ============================================================================

create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  network            text not null,                 -- 'awin'
  network_product_id text not null,                 -- unique id within the network
  merchant_id        text,
  merchant_name      text,
  feed_id            text,
  title              text not null,
  description        text,
  image_url          text,
  price              numeric,
  currency           text not null default 'USD',
  category           text,                          -- raw network category
  tags               text[] not null default '{}',  -- internal TAGS
  occasions          text[] not null default '{}',  -- internal OCCASIONS
  recipients         text[] not null default '{}',  -- internal RECIPIENTS
  gender             text not null default 'unisex',
  affiliate_link     text not null,                 -- tracked deep link
  in_stock           boolean not null default true,
  active             boolean not null default true, -- false once it leaves the feed
  last_seen_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (network, network_product_id)
);

create index if not exists products_active_idx     on public.products (active);
create index if not exists products_network_idx     on public.products (network);
create index if not exists products_tags_idx        on public.products using gin (tags);
create index if not exists products_occasions_idx   on public.products using gin (occasions);
create index if not exists products_recipients_idx  on public.products using gin (recipients);

-- One row per sync run, for observability + "which network converts" later.
create table if not exists public.affiliate_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  network         text not null,
  feeds_processed int,
  imported        int,
  deactivated     int,
  status          text,
  detail          jsonb not null default '{}',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

alter table public.products            enable row level security;
alter table public.affiliate_sync_runs enable row level security;
-- No public policies → only the service role can read/write these.
