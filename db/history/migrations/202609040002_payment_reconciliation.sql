alter table public.payment_recovery_actions
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists leased_until timestamptz;

create index if not exists payment_recovery_due_idx
  on public.payment_recovery_actions (next_attempt_at, leased_until)
  where status in ('processing', 'refund_pending', 'failed');

create unique index if not exists payment_webhook_provider_event_unique
  on public.payment_webhook_events (provider, event_id);

alter table public.payment_webhook_events
  add column if not exists processing_started_at timestamptz;

create or replace function public.claim_payment_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  insert into public.payment_webhook_events (
    provider, event_id, event_type, razorpay_order_id,
    razorpay_payment_id, payload, processed, processing_started_at
  ) values (
    p_provider, p_event_id, p_event_type, p_razorpay_order_id,
    p_razorpay_payment_id, p_payload, false, now()
  )
  on conflict (provider, event_id) do update
    set processing_started_at = now(),
        payload = excluded.payload
    where not public.payment_webhook_events.processed
      and (
        public.payment_webhook_events.processing_started_at is null
        or public.payment_webhook_events.processing_started_at < now() - interval '5 minutes'
      );

  v_claimed := found;
  return v_claimed;
end;
$$;

revoke all on function public.claim_payment_webhook_event(text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_payment_webhook_event(text, text, text, text, text, jsonb)
  to service_role;

create or replace function public.claim_due_payment_recovery_actions(p_limit integer default 20)
returns setof public.payment_recovery_actions
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
      from public.payment_recovery_actions
     where status in ('processing', 'refund_pending', 'failed')
       and next_attempt_at <= now()
       and (leased_until is null or leased_until < now())
       and attempt_count < 8
     order by next_attempt_at, created_at
     limit greatest(1, least(coalesce(p_limit, 20), 50))
     for update skip locked
  )
  update public.payment_recovery_actions action
     set leased_until = now() + interval '5 minutes',
         attempt_count = action.attempt_count + 1,
         updated_at = now()
    from due
   where action.id = due.id
  returning action.*;
end;
$$;

revoke all on function public.claim_due_payment_recovery_actions(integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_payment_recovery_actions(integer)
  to service_role;
