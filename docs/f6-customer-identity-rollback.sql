-- F6 CUSTOMER IDENTITY — PROPOSAL ONLY. DESTRUCTIVE: deletes F6 customer
-- identities, sessions and profile data. Use only after an approved backup and
-- after confirming no commerce FKs or application services depend on them.
begin;
drop table if exists public.customer_profiles;
drop table if exists public.customer_sessions;
drop table if exists public.customer_identities;
commit;
