begin;

alter table if exists public.education_posts
  add column if not exists card_title text,
  add column if not exists card_image_path text;

create table if not exists public.education_page_hero (
  id smallint primary key default 1 check (id = 1),
  is_enabled boolean not null default true,
  heading text not null default 'Education',
  paragraph text,
  button_label text,
  button_link text,
  desktop_image_path text,
  desktop_image_alt text,
  mobile_image_path text,
  mobile_image_alt text,
  updated_at timestamptz not null default now()
);

insert into public.education_page_hero (id, heading, paragraph, button_label, button_link)
values (1, 'Education', 'Clear, considered guidance on diamonds, jewellery, craftsmanship, care, and confident buying decisions.', 'Explore articles', '#education-articles')
on conflict (id) do nothing;

alter table public.education_page_hero enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='education_page_hero' and policyname='Public can read education hero') then
    create policy "Public can read education hero" on public.education_page_hero for select to anon, authenticated using (true);
  end if;
end $$;

grant select on public.education_page_hero to anon, authenticated;

commit;