-- Migration: 20261124010000_once_webhook_idempotency.sql
-- Description: Adds idempotency key, timestamps, and indexes to once_webhook_events
-- and indexes to once_distribution_releases for safe webhook processing and retry handling.

alter table public.once_webhook_events
  add column if not exists dedupe_key text,
  add column if not exists occurred_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists signature_verified boolean not null default false;

-- Unique partial index to prevent duplicate processing of the same verified webhook event
create unique index if not exists idx_once_webhook_events_dedupe_key
  on public.once_webhook_events (dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_once_webhook_events_once_release_id
  on public.once_webhook_events (once_release_id);

create index if not exists idx_once_distribution_releases_once_release_id
  on public.once_distribution_releases (once_release_id);
