-- Premium subscriptions for music.zedbute.com access
create table if not exists public.premium_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount numeric not null,
  payment_status text not null default 'pending',
  status text not null default 'pending_approval',
  transaction_id text,
  phone_number text,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.premium_subscriptions enable row level security;

create policy "users read own subscriptions"
  on public.premium_subscriptions for select
  using (auth.uid() = user_id);

create policy "users insert own subscriptions"
  on public.premium_subscriptions for insert
  with check (auth.uid() = user_id);

-- Approval is done by the team (service role / dashboard):
-- update public.premium_subscriptions
--   set status = 'approved', approved_at = now(),
--       expires_at = now() + interval '1 month'   -- or '1 year' for yearly plans
--   where id = '<subscription-id>';
