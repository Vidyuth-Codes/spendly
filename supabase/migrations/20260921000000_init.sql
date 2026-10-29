-- Spendly initial schema.
-- Money is stored as integer paise (INR minor units). Dates are plain DATEs
-- (the day the user means), so there are no timezone surprises in daily/weekly grouping.
-- Every table carries user_id and is protected by Row Level Security.

-- ---------------------------------------------------------------- enums
create type public.txn_type as enum ('expense', 'income');
create type public.payment_method as enum ('upi', 'cash', 'card', 'bank', 'other');

-- ------------------------------------------------------------ helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------ profiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency     text not null default 'INR',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- categories
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  kind        public.txn_type not null default 'expense',
  icon        text not null default 'pricetag-outline',  -- Ionicons name
  color       text not null default '#8E8E93' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  -- lets transactions/budgets prove a category belongs to the same user
  unique (id, user_id)
);

create unique index categories_unique_name
  on public.categories (user_id, kind, lower(btrim(name)))
  where archived_at is null;

-- -------------------------------------------------------- transactions
create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           public.txn_type not null default 'expense',
  amount_paise   bigint not null check (amount_paise > 0),
  category_id    uuid,
  merchant       text check (merchant is null or char_length(merchant) <= 80),
  note           text check (note is null or char_length(note) <= 280),
  payment_method public.payment_method not null default 'upi',
  occurred_on    date not null default current_date,
  -- set by CSV import so re-uploading a statement does not duplicate rows
  import_hash    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- category must belong to the same user; deleting a category just un-categorizes
  foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete set null (category_id)
);

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

create index transactions_user_date on public.transactions (user_id, occurred_on desc);
create index transactions_user_category on public.transactions (user_id, category_id);
create unique index transactions_import_hash
  on public.transactions (user_id, import_hash) where import_hash is not null;

-- ------------------------------------------------------ income sources
-- Recurring income such as "5,000 from Dad on the 1st". The app materializes
-- these into transactions (type = income); last_applied_month keeps that idempotent.
create table public.income_sources (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 60),
  amount_paise       bigint not null check (amount_paise > 0),
  day_of_month       smallint not null default 1 check (day_of_month between 1 and 31),
  active             boolean not null default true,
  last_applied_month date,  -- first day of the last month it was applied
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger income_sources_updated_at before update on public.income_sources
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- budgets
-- Monthly spending limits. category_id NULL = the overall monthly budget.
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category_id  uuid,
  amount_paise bigint not null check (amount_paise > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete cascade,
  unique nulls not distinct (user_id, category_id)
);

create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

-- ------------------------------------------------- new-user bootstrap
-- On signup: create the profile and seed default categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.categories (user_id, name, kind, icon, color) values
    (new.id, 'Food',          'expense', 'fast-food-outline',   '#F97316'),
    (new.id, 'Groceries',     'expense', 'cart-outline',        '#84CC16'),
    (new.id, 'Travel',        'expense', 'bus-outline',         '#3B82F6'),
    (new.id, 'Bills',         'expense', 'receipt-outline',     '#EF4444'),
    (new.id, 'Shopping',      'expense', 'bag-handle-outline',  '#EC4899'),
    (new.id, 'Entertainment', 'expense', 'film-outline',        '#8B5CF6'),
    (new.id, 'Health',        'expense', 'medkit-outline',      '#14B8A6'),
    (new.id, 'Education',     'expense', 'school-outline',      '#F59E0B'),
    (new.id, 'Other',         'expense', 'ellipsis-horizontal-circle-outline', '#8E8E93'),
    (new.id, 'Allowance',     'income',  'cash-outline',        '#0F9D58'),
    (new.id, 'Salary',        'income',  'briefcase-outline',   '#16A34A'),
    (new.id, 'Other income',  'income',  'add-circle-outline',  '#22C55E');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------- row level security
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.transactions   enable row level security;
alter table public.income_sources enable row level security;
alter table public.budgets        enable row level security;

-- Profiles are created by the trigger, so users may only read and update their own.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Same full-CRUD, own-rows-only policy for the user-owned tables.
do $$
declare t text;
begin
  foreach t in array array['categories', 'transactions', 'income_sources', 'budgets'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || ': own rows', t);
  end loop;
end;
$$;

-- Defense in depth: the anon role never needs these tables.
revoke all on public.profiles, public.categories, public.transactions,
              public.income_sources, public.budgets from anon;
