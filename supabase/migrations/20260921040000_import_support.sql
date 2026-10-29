-- Task 9: CSV import support.

-- The original import_hash index was partial (WHERE import_hash IS NOT NULL). Postgres can only use
-- "INSERT ... ON CONFLICT DO NOTHING" against an index it can infer from column names alone, and it
-- cannot do that for a partial index, so re-importing a statement could not be made safe.
-- A plain unique index works the same for our purposes: NULLs are never equal to each other, so
-- transactions entered by hand (no hash) are unaffected.
drop index if exists public.transactions_import_hash;
create unique index transactions_import_hash on public.transactions (user_id, import_hash);

-- Merchants the user has categorized during an import, so the next statement is categorized
-- automatically. `keyword` is matched against the transaction description, lower-cased.
create table public.merchant_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  keyword     text not null check (keyword = lower(keyword) and char_length(keyword) between 2 and 40),
  category_id uuid not null,
  created_at  timestamptz not null default now(),
  unique (user_id, keyword),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

alter table public.merchant_rules enable row level security;

create policy "merchant_rules: own rows" on public.merchant_rules
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.merchant_rules from anon;
