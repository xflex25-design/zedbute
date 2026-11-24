-- Migration: 20261124030000_complete_supabase_database_audit.sql
-- Description: Ensures all 13 required tables exist with complete relationships, RLS policies,
-- and secure business audit support for ZedBute.

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  artist_name text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Releases Table (maps to music_releases / once_distribution_releases)
create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

-- 3. Tracks Table (maps to release_tracks)
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

-- 4. Contributors Table
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

-- 5. Artwork Table
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

-- 6. Distribution Stores Table
create table if not exists public.distribution_stores (
  id integer primary key,
  name text not null,
  featured boolean not null default false,
  enabled_by_default boolean not null default true,
  partner_only boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7. Payments Table (maps to release_payments)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  amount numeric not null,
  currency text not null default 'ZMW',
  payment_method text not null default 'mobile_money',
  phone_number text,
  transaction_id text not null,
  status text not null default 'pending',
  payment_date timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Currency Rates Table
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

-- 9. Once Submissions Table (maps to once_distribution_releases)
create table if not exists public.once_submissions (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
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

-- 10. Once Credits Table
create table if not exists public.once_credits (
  id uuid primary key default gen_random_uuid(),
  balance integer not null default 0,
  currency text not null default 'CREDITS',
  low_credit_threshold integer not null default 10,
  updated_at timestamptz not null default now()
);

-- 11. Release Status Table
create table if not exists public.release_status (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete cascade,
  once_release_id text,
  aggregate_status text not null default 'draft',
  store_statuses jsonb not null default '[]'::jsonb,
  artist_profiles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 12. Webhook Events Table (maps to once_webhook_events)
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

-- 13. Financial Records Table
create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
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

-- Enable RLS on all 13 tables
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

-- RLS Policies: Artists own records, Admins access all
create policy "users read own profiles" on public.profiles for select using (auth.uid() = id or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
create policy "users update own profiles" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profiles" on public.profiles for insert with check (auth.uid() = id);

create policy "users manage own releases" on public.releases for all using (auth.uid() = user_id or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')) with check (auth.uid() = user_id);
create policy "users manage own tracks" on public.tracks for all using (exists (select 1 from public.releases where releases.id = tracks.release_id and (releases.user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')))) with check (true);
create policy "users manage own contributors" on public.contributors for all using (exists (select 1 from public.releases where releases.id = contributors.release_id and (releases.user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')))) with check (true);
create policy "users manage own artwork" on public.artwork for all using (exists (select 1 from public.releases where releases.id = artwork.release_id and (releases.user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')))) with check (true);

create policy "anyone read distribution_stores" on public.distribution_stores for select to authenticated, anon using (true);
create policy "admins manage distribution_stores" on public.distribution_stores for all using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "users manage own payments" on public.payments for all using (auth.uid() = user_id or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')) with check (auth.uid() = user_id);

create policy "anyone read currency_rates" on public.currency_rates for select to authenticated, anon using (true);
create policy "admins manage currency_rates" on public.currency_rates for all using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "users manage own once_submissions" on public.once_submissions for all using (auth.uid() = user_id or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')) with check (auth.uid() = user_id);

create policy "anyone read once_credits" on public.once_credits for select to authenticated using (true);
create policy "admins manage once_credits" on public.once_credits for all using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "users read own release_status" on public.release_status for select using (exists (select 1 from public.releases where releases.id = release_status.release_id and (releases.user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))));
create policy "admins manage release_status" on public.release_status for all using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "admins read webhook_events" on public.webhook_events for select using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
create policy "system insert webhook_events" on public.webhook_events for insert with check (true);

create policy "admins manage financial_records" on public.financial_records for all using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
create policy "users read own financial_records" on public.financial_records for select using (auth.uid() = user_id);
create policy "users insert own financial_records" on public.financial_records for insert with check (auth.uid() = user_id);
