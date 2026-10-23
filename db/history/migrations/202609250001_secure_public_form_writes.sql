begin;

-- Public forms write through rate-limited server routes using the service role.
-- Remove direct browser write privileges so the public anon key cannot bypass
-- API validation and throttling. Existing rows and read policies are untouched.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'contact_submissions',
    'bespoke_submissions',
    'newsletter_submissions',
    'promotion_popup_responses',
    'promotion_popup_submissions'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('alter table public.%I enable row level security', relation_name);
      execute format('revoke insert, update, delete, truncate on table public.%I from anon, authenticated', relation_name);
    end if;
  end loop;
end;
$$;

commit;
