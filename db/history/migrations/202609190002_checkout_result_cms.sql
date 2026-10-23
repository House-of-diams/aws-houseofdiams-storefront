begin;

-- Shared visual configuration for the checkout result page.
-- This table is intentionally independent from orders and payment processing.
create table if not exists public.checkout_result_page (
  id smallint primary key default 1,
  main_banner_image_path text,
  main_banner_image_alt text,
  secondary_banner_image_path text,
  secondary_banner_image_alt text,
  secondary_eyebrow text,
  secondary_heading text,
  secondary_paragraph text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_result_page_singleton_check check (id = 1)
);

-- State-specific copy for the main hero. The storefront may use code fallbacks
-- whenever a value is null or blank.
create table if not exists public.checkout_result_states (
  state text primary key,
  eyebrow text,
  heading text,
  paragraph text,
  order_button_label text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_result_states_state_check
    check (state in ('success', 'pending', 'failed', 'error'))
);

comment on table public.checkout_result_page is
  'CMS-managed shared banner media and secondary banner content for checkout result pages.';
comment on table public.checkout_result_states is
  'CMS-managed main hero copy for success, pending, failed, and error checkout states.';
comment on column public.checkout_result_page.main_banner_image_path is
  'Storage object path or public image URL for the main checkout result hero.';
comment on column public.checkout_result_page.secondary_banner_image_path is
  'Storage object path or public image URL for the shorter secondary banner.';

-- Keep updated_at consistent without depending on any existing project trigger.
create or replace function public.touch_checkout_result_cms_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists checkout_result_page_touch_updated_at
  on public.checkout_result_page;
create trigger checkout_result_page_touch_updated_at
before update on public.checkout_result_page
for each row
execute function public.touch_checkout_result_cms_updated_at();

drop trigger if exists checkout_result_states_touch_updated_at
  on public.checkout_result_states;
create trigger checkout_result_states_touch_updated_at
before update on public.checkout_result_states
for each row
execute function public.touch_checkout_result_cms_updated_at();

-- Seed one shared page row. Blank values intentionally allow storefront code
-- fallbacks until content is published through the admin CMS.
insert into public.checkout_result_page (
  id,
  main_banner_image_path,
  main_banner_image_alt,
  secondary_banner_image_path,
  secondary_banner_image_alt,
  secondary_eyebrow,
  secondary_heading,
  secondary_paragraph,
  is_enabled
) values (
  1,
  null,
  null,
  null,
  null,
  'Made with intention',
  'Every piece tells a story.',
  'Your jewellery is prepared and inspected with care before it begins its journey to you.',
  true
)
on conflict (id) do nothing;

insert into public.checkout_result_states (
  state,
  eyebrow,
  heading,
  paragraph,
  order_button_label,
  is_enabled
) values
  (
    'success',
    'Order confirmed',
    'A beautiful choice, now officially yours.',
    'Your order has been successfully placed and our team is preparing it with care.',
    'View my order',
    true
  ),
  (
    'pending',
    'Payment confirmation pending',
    'We are confirming your order.',
    'Your payment status is still being confirmed. Please keep this page open or check again shortly.',
    'View order status',
    true
  ),
  (
    'failed',
    'Payment unsuccessful',
    'Your order has not been completed.',
    'The payment was not completed and no confirmed order has been placed. You can safely try again.',
    'Return to checkout',
    true
  ),
  (
    'error',
    'Confirmation unavailable',
    'We could not confirm your order right now.',
    'Your payment may still be processing. Please check again shortly or contact our concierge for assistance.',
    'Check order status',
    true
  )
on conflict (state) do nothing;

-- Public storefront clients may read published content only. All writes remain
-- server-side through the service role used by the admin application.
alter table public.checkout_result_page enable row level security;
alter table public.checkout_result_states enable row level security;

revoke all on table public.checkout_result_page from public, anon, authenticated;
revoke all on table public.checkout_result_states from public, anon, authenticated;

grant select on table public.checkout_result_page to anon, authenticated;
grant select on table public.checkout_result_states to anon, authenticated;
grant select, insert, update, delete on table public.checkout_result_page to service_role;
grant select, insert, update, delete on table public.checkout_result_states to service_role;

drop policy if exists checkout_result_page_public_read
  on public.checkout_result_page;
create policy checkout_result_page_public_read
on public.checkout_result_page
for select
to anon, authenticated
using (is_enabled = true);

drop policy if exists checkout_result_states_public_read
  on public.checkout_result_states;
create policy checkout_result_states_public_read
on public.checkout_result_states
for select
to anon, authenticated
using (is_enabled = true);

-- Prevent direct execution of the trigger helper by storefront roles.
revoke all on function public.touch_checkout_result_cms_updated_at()
  from public, anon, authenticated;

commit;

-- Verification. Expected: one page row and four state rows.
select
  (select count(*) from public.checkout_result_page) as page_rows,
  (select count(*) from public.checkout_result_states) as state_rows;

select
  state_row.state,
  state_row.is_enabled,
  state_row.eyebrow,
  state_row.heading
from public.checkout_result_states as state_row
order by case state_row.state
  when 'success' then 1
  when 'pending' then 2
  when 'failed' then 3
  when 'error' then 4
  else 5
end;
