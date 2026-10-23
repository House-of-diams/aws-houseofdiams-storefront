create table if not exists public.payment_recovery_actions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'razorpay' check (provider in ('razorpay')),
  payment_id text not null,
  amount_subunits bigint not null check (amount_subunits > 0),
  currency text not null check (char_length(currency) = 3),
  reason_code text not null,
  status text not null default 'processing'
    check (status in ('processing', 'refund_pending', 'refunded', 'failed', 'manual_review')),
  provider_refund_id text,
  attempt_count integer not null default 1 check (attempt_count >= 0),
  last_error text,
  requested_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_recovery_provider_payment_unique unique (provider, payment_id)
);

create unique index if not exists payment_recovery_provider_refund_unique
  on public.payment_recovery_actions (provider, provider_refund_id)
  where provider_refund_id is not null;

create index if not exists payment_recovery_status_updated_idx
  on public.payment_recovery_actions (status, updated_at);

alter table public.payment_recovery_actions enable row level security;
revoke all on table public.payment_recovery_actions from public, anon, authenticated;
grant select, insert, update on table public.payment_recovery_actions to service_role;

create or replace function public.claim_payment_recovery_action(
  p_order_id uuid,
  p_payment_id text,
  p_amount_subunits bigint,
  p_currency text,
  p_reason_code text
)
returns table (
  action_id uuid,
  action_status text,
  should_attempt boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.payment_recovery_actions%rowtype;
  v_inserted boolean := false;
begin
  if p_order_id is null
     or nullif(trim(coalesce(p_payment_id, '')), '') is null
     or coalesce(p_amount_subunits, 0) <= 0
     or char_length(trim(coalesce(p_currency, ''))) <> 3
     or nullif(trim(coalesce(p_reason_code, '')), '') is null then
    raise exception 'Invalid payment recovery claim.' using errcode = '22023';
  end if;

  insert into public.payment_recovery_actions (
    order_id,
    provider,
    payment_id,
    amount_subunits,
    currency,
    reason_code,
    status
  ) values (
    p_order_id,
    'razorpay',
    trim(p_payment_id),
    p_amount_subunits,
    upper(trim(p_currency)),
    trim(p_reason_code),
    'processing'
  )
  on conflict (provider, payment_id) do nothing
  returning * into v_action;

  v_inserted := found;

  if not v_inserted then
    select * into v_action
      from public.payment_recovery_actions
     where provider = 'razorpay'
       and payment_id = trim(p_payment_id);
  end if;

  return query select v_action.id, v_action.status, v_inserted;
end;
$$;

revoke all on function public.claim_payment_recovery_action(uuid, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_payment_recovery_action(uuid, text, bigint, text, text)
  to service_role;

comment on table public.payment_recovery_actions is
  'Durable, idempotent recovery ledger for captured payments whose orders could not be fulfilled.';

