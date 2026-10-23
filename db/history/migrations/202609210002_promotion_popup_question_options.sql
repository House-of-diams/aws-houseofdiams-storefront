alter table public.promotion_popup_questions add column if not exists options jsonb not null default '[]'::jsonb;
