alter table public.blog_posts
  add column if not exists hero_image_alt text;

comment on column public.blog_posts.hero_image_alt is
  'Alternative text for the blog hero image. Null falls back to the article title.';
