-- Keep the public portfolio read policy separate from administrator access.
-- The former admin policy applied to the `public` role, which made anonymous
-- reads evaluate `is_admin()` and caused recursive RLS evaluation.
drop policy if exists "bespoke portfolio items admin write"
  on public.bespoke_portfolio_items;

create policy "bespoke portfolio items admin write"
  on public.bespoke_portfolio_items
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());
