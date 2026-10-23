begin;

alter table public.site_settings
  add column if not exists estimated_delivery_text text not null default 'Approximately 3 to 4 weeks';

commit;
