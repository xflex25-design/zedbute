-- Admin panel support for premium_subscriptions:
-- 1) admins can read all subscriptions
-- 2) one-click approval via a SECURITY DEFINER function (artists cannot self-approve)

create policy "admins read all subscriptions"
  on public.premium_subscriptions for select
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_approve_premium(p_subscription_id uuid)
returns public.premium_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.premium_subscriptions;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can approve premium subscriptions';
  end if;

  update public.premium_subscriptions
  set status = 'approved',
      approved_at = now(),
      expires_at = now() + case when plan = 'yearly' then interval '1 year' else interval '1 month' end
  where id = p_subscription_id
    and status = 'pending_approval'
  returning * into v_sub;

  if v_sub.id is null then
    raise exception 'Subscription not found or already processed';
  end if;

  return v_sub;
end;
$$;

grant execute on function public.admin_approve_premium(uuid) to authenticated;
