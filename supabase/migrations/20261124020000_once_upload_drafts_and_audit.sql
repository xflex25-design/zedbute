-- Migration: 20261124020000_once_upload_drafts_and_audit.sql
-- Description: Adds upload wizard draft tracking fields, admin review metadata,
-- ONCE validation errors, and an immutable admin audit log for ONCE distribution operations.

alter table public.once_distribution_releases
  add column if not exists current_step integer not null default 1,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists last_quote jsonb,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

create index if not exists idx_once_distribution_releases_user_status
  on public.once_distribution_releases (user_id, status, updated_at desc);

create table if not exists public.once_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text not null default 'artist',
  action text not null,
  release_id uuid,
  once_release_id text,
  status text not null default 'info',
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_once_audit_logs_created_at
  on public.once_audit_logs (created_at desc);

create index if not exists idx_once_audit_logs_release_id
  on public.once_audit_logs (release_id);

alter table public.once_audit_logs enable row level security;

create policy "admins read all once_audit_logs"
  on public.once_audit_logs for select
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

create policy "artists read own once_audit_logs"
  on public.once_audit_logs for select
  using (auth.uid() = actor_user_id);

create policy "authenticated insert once_audit_logs"
  on public.once_audit_logs for insert
  with check (
    auth.uid() = actor_user_id
    or exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );
