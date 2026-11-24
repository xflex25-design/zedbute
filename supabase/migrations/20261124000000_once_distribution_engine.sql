-- Migration: 20261124000000_once_distribution_engine.sql
-- Description: Adds ONCE Music Distribution Engine tables for automated distribution,
-- release tracking, store statuses, credit tracking, and webhooks.

create table if not exists public.once_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  once_account_id text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint once_accounts_user_unique unique(user_id)
);

create table if not exists public.once_distribution_releases (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.music_releases(id) on delete set null,
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
  artist_profiles jsonb not null default '[]'::jsonb,
  status text not null default 'draft', -- draft, pending_submission, processing, under_review, approved, delivered, distributed, live, failed, rejected
  is_ai_detected boolean not null default false,
  ai_score numeric,
  predicted_ai_model text,
  acr_matched boolean not null default false,
  acr_best_match jsonb,
  credit_cost integer not null default 1,
  credits_debited integer not null default 0,
  submission_error text,
  submitted_at timestamptz,
  approved_at timestamptz,
  distributed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.once_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  once_release_id text,
  payload jsonb not null,
  signature text,
  processed boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.once_engine_settings (
  id text primary key default 'default',
  auto_distribute_default boolean not null default false,
  require_admin_approval boolean not null default true,
  single_upload_price_zmw numeric not null default 70,
  updated_at timestamptz not null default now()
);

-- Seed default engine settings
insert into public.once_engine_settings (id, auto_distribute_default, require_admin_approval, single_upload_price_zmw)
values ('default', false, true, 70)
on conflict (id) do nothing;

-- Enable RLS
alter table public.once_accounts enable row level security;
alter table public.once_distribution_releases enable row level security;
alter table public.once_webhook_events enable row level security;
alter table public.once_engine_settings enable row level security;

-- Policies for once_accounts: Users can read/write their own account record
create policy "users read own once_accounts"
  on public.once_accounts for select
  using (auth.uid() = user_id);

create policy "users insert own once_accounts"
  on public.once_accounts for insert
  with check (auth.uid() = user_id);

create policy "users update own once_accounts"
  on public.once_accounts for update
  using (auth.uid() = user_id);

-- Policies for once_distribution_releases: Users can read own; Admins can read/manage all
create policy "users read own once_distribution_releases"
  on public.once_distribution_releases for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

create policy "users insert own once_distribution_releases"
  on public.once_distribution_releases for insert
  with check (auth.uid() = user_id);

create policy "users and admins update once_distribution_releases"
  on public.once_distribution_releases for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

-- Admins can view webhook events
create policy "admins read once_webhook_events"
  on public.once_webhook_events for select
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

-- Everyone authenticated can read engine settings (e.g. upload price), admins can update
create policy "anyone read once_engine_settings"
  on public.once_engine_settings for select
  to authenticated, anon
  using (true);

create policy "admins update once_engine_settings"
  on public.once_engine_settings for update
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );
