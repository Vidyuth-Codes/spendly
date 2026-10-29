-- Run in the Supabase SQL editor AFTER the migration and after signing up two test users.

-- 1) Every table should show rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2) Each user should have exactly 12 seeded categories (9 expense + 3 income).
select user_id, count(*) as categories
from public.categories
group by user_id;

-- 3) Impersonate user A and confirm they only see their own rows.
--    Replace the uuid below with a real id from auth.users.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000"}', true);
select count(*) as visible_categories from public.categories;  -- expect 12, not 24
rollback;
