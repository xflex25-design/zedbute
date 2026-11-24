-- Migration: 20261124040000_required_13_tables_and_relations.sql
-- Description: Defines the 13 required ZedBute Supabase tables with strict foreign key relationships,
-- data types, defaults, and timestamps.

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  artist_name text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. releases (Linked to profiles via user_id)
create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  artist_name text not null,
  producer_name text,
  legal_name text,
  release_type text not null default 'single',
  genre text,
  release_date date,
  cover_art_url text,
  audio_url text,
  status text not null default 'draft',
  upload_progress integer default 0,
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. tracks (Linked to releases via release_id)
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  track_number integer not null default 1,
  title text not null,
  audio_url text,
  duration_seconds integer,
  isrc text,
  explicit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. contributors (Linked to releases via release_id)
create table if not exists public.contributors (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  name text not null,
  role text not null,
  society text,
  ipi text,
  share_percent numeric,
  created_at timestamptz not null default now()
);

-- 5. artwork (Linked to releases via release_id)
create table if not exists public.artwork (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  file_url text not null,
  file_name text,
  width integer,
  height integer,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

-- 6. distribution_stores (Independent DSP reference table)
create table if not exists public.distribution_stores (
  id integer primary key,
  name text not null,
  featured boolean not null default false,
  enabled_by_default boolean not null default true,
  partner_only boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7. payments (Linked to profiles via user_id and optionally releases via release_id)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  amount numeric not null,
  currency text not null default 'ZMW',
  payment_method text not null default 'mobile_money',
  phone_number text,
  transaction_id text not null,
  status text not null default 'pending',
  payment_date timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. currency_rates (Independent exchange rate caching table)
create table if not exists public.currency_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'ZMW',
  target_currency text not null default 'USD',
  rate numeric not null,
  source text not null default 'freecurrencyapi',
  is_stale boolean not null default false,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 9. once_submissions (Linked to profiles via user_id and releases via release_id)
create table if not exists public.once_submissions (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  once_release_id text unique,
  once_draft_id text,
  title text not null,
  primary_artist text not null,
  release_type text not null default 'single',
  upc text,
  isrc text,
  cover_art_url text,
  audio_url text,
  metadata jsonb not null default '{}'::jsonb,
  distribution_store_ids jsonb not null default '[]'::jsonb,
  store_statuses jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  credit_cost integer not null default 1,
  credits_debited integer not null default 0,
  submission_error text,
  submitted_at timestamptz,
  approved_at timestamptz,
  distributed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. once_credits (System ONCE API credit balance tracking)
create table if not exists public.once_credits (
  id uuid primary key default gen_random_uuid(),
  balance integer not null default 0,
  currency text not null default 'CREDITS',
  low_credit_threshold integer not null default 10,
  updated_at timestamptz not null default now()
);

-- 11. release_status (Linked to releases via release_id)
create table if not exists public.release_status (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete cascade,
  once_release_id text,
  aggregate_status text not null default 'draft',
  store_statuses jsonb not null default '[]'::jsonb,
  artist_profiles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 12. webhook_events (Webhook idempotency and log table)
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  once_release_id text,
  dedupe_key text unique,
  payload jsonb not null,
  signature text,
  signature_verified boolean not null default false,
  processed boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

-- 13. financial_records (Linked to profiles via user_id and releases via release_id)
create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  once_release_id text,
  title text,
  payment_type text not null,
  payment_gateway text not null default 'lenco',
  payment_status text not null default 'verified',
  amount_zmw numeric not null,
  amount_usd numeric,
  zmw_to_usd_rate numeric,
  usd_to_zmw_rate numeric,
  exchange_rate_date date,
  exchange_rate_source text,
  exchange_rate_is_stale boolean not null default false,
  processing_fee_zmw numeric not null default 0,
  processing_fee_usd numeric,
  once_expense_usd numeric not null default 0,
  once_expense_zmw numeric,
  net_profit_zmw numeric,
  net_profit_usd numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security on all 13 tables
alter table public.profiles enable row level security;
alter table public.releases enable row level security;
alter table public.tracks enable row level security;
alter table public.contributors enable row level security;
alter table public.artwork enable row level security;
alter table public.distribution_stores enable row level security;
alter table public.payments enable row level security;
alter table public.currency_rates enable row level security;
alter table public.once_submissions enable row level security;
alter table public.once_credits enable row level security;
alter table public.release_status enable row level security;
alter table public.webhook_events enable row level security;
alter table public.financial_records enable row level security;
