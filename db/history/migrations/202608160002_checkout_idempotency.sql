create table if not exists public.checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  order_id uuid references public.orders(id) on delete set null,
  razorpay_order_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint checkout_attempts_user_key_unique unique (user_id, idempotency_key),
  constraint checkout_attempts_idempotency_key_length
    check (char_length(idempotency_key) between 16 and 128)
);

create index if not exists checkout_attempts_order_id_idx
  on public.checkout_attempts (order_id)
  where order_id is not null;

create index if not exists checkout_attempts_expires_at_idx
  on public.checkout_attempts (expires_at);

alter table public.checkout_attempts enable row level security;

revoke all on table public.checkout_attempts from anon, authenticated;
grant select, insert, update, delete on table public.checkout_attempts to service_role;

comment on table public.checkout_attempts is
  'Server-only idempotency claims for checkout order creation. One key per user prevents duplicate Razorpay and internal orders.';
