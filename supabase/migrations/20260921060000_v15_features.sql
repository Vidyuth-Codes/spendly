-- v1.5: recurring expenses, tags, lent/borrowed tracker, and a column for receipt photos.

-- ------------------------------------------------------------- recurring expenses
-- Rent, Netflix, a phone recharge: money that leaves every month. Works exactly like income sources:
-- the app asks the server to add what is due, and last_applied_month makes that safe to repeat.
create table public.recurring_expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 60),
  amount_paise       bigint not null check (amount_paise > 0),
  category_id        uuid,
  payment_method     public.payment_method not null default 'upi',
  day_of_month       smallint not null default 1 check (day_of_month between 1 and 31),
  active             boolean not null default true,
  last_applied_month date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

create trigger recurring_expenses_updated_at before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------- new transaction columns
-- A tag is a short lower-case word such as "trip-goa". At most 10 per transaction.
create or replace function public.valid_tags(t text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(t) <= 10
     and coalesce((select bool_and(x ~ '^[a-z0-9_-]{1,24}$') from unnest(t) as x), true);
$$;

alter table public.transactions
  add column recurring_expense_id uuid references public.recurring_expenses (id) on delete set null,
  add column tags text[] not null default '{}' check (public.valid_tags(tags)),
  add column receipt_path text check (receipt_path is null or char_length(receipt_path) <= 200);

create index transactions_tags on public.transactions using gin (tags);

-- ------------------------------------------------------------------ lent / borrowed
-- Money between you and other people. Kept apart from transactions on purpose: lending a friend
-- 500 is not spending, so it should not eat into your budget.
create table public.loans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  person       text not null check (char_length(btrim(person)) between 1 and 60),
  direction    text not null check (direction in ('lent', 'borrowed')),
  amount_paise bigint not null check (amount_paise > 0),
  note         text check (note is null or char_length(note) <= 280),
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);

create trigger loans_updated_at before update on public.loans
  for each row execute function public.set_updated_at();

create table public.loan_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  loan_id      uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  paid_on      date not null default current_date,
  created_at   timestamptz not null default now(),
  foreign key (loan_id, user_id) references public.loans (id, user_id) on delete cascade
);

create index loan_payments_loan on public.loan_payments (loan_id, paid_on desc);

-- Repayments can never add up to more than the loan, and a loan cannot be edited below what is
-- already repaid. (Enforced here so it holds no matter which client writes.)
create or replace function public.guard_loan_payments()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  loan_amount bigint;
  paid        bigint;
begin
  if tg_table_name = 'loan_payments' then
    select amount_paise into loan_amount from public.loans where id = new.loan_id and user_id = new.user_id;
    select coalesce(sum(amount_paise), 0) into paid
    from public.loan_payments
    where loan_id = new.loan_id and user_id = new.user_id and id is distinct from new.id;
    if paid + new.amount_paise > loan_amount then
      raise exception 'That is more than the remaining balance';
    end if;
  else
    select coalesce(sum(amount_paise), 0) into paid from public.loan_payments where loan_id = new.id and user_id = new.user_id;
    if new.amount_paise < paid then
      raise exception 'The amount cannot be lower than what has already been repaid';
    end if;
  end if;
  return new;
end;
$$;

create trigger loan_payments_guard before insert or update on public.loan_payments
  for each row execute function public.guard_loan_payments();
create trigger loans_guard before update of amount_paise on public.loans
  for each row execute function public.guard_loan_payments();

-- ------------------------------------------------------------------------- RLS
alter table public.recurring_expenses enable row level security;
alter table public.loans              enable row level security;
alter table public.loan_payments      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recurring_expenses', 'loans', 'loan_payments'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || ': own rows', t);
  end loop;
end;
$$;

revoke all on public.recurring_expenses, public.loans, public.loan_payments from anon;

-- ------------------------------------------------------------ apply_recurring_expenses
-- Adds every recurring expense that is due as an expense transaction, once per month. Same rules as
-- apply_recurring_income: a new item starts from the current month (no backfilled history), missed
-- months are caught up (at most 12), day 31 falls on the last day of shorter months, and calling it
-- again changes nothing.
create or replace function public.apply_recurring_expenses(p_today date default current_date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  src        record;
  uid        uuid := (select auth.uid());
  this_month date := date_trunc('month', p_today)::date;
  m          date;
  due        date;
  created    integer := 0;
begin
  for src in
    select * from public.recurring_expenses where user_id = uid and active for update
  loop
    m := case
      when src.last_applied_month is null then this_month
      else (src.last_applied_month + interval '1 month')::date
    end;
    m := greatest(m, (this_month - interval '11 months')::date);

    while m <= this_month loop
      due := least(m + (src.day_of_month - 1), (m + interval '1 month - 1 day')::date);
      exit when due > p_today;

      insert into public.transactions
        (user_id, type, amount_paise, category_id, merchant, payment_method, occurred_on, recurring_expense_id)
      values
        (src.user_id, 'expense', src.amount_paise, src.category_id, src.name, src.payment_method, due, src.id);

      update public.recurring_expenses set last_applied_month = m where id = src.id;
      created := created + 1;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  return created;
end;
$$;

-- ------------------------------------------------------------------------- tags
-- Expense totals per tag. A transaction with two tags counts once under each, so tag totals can add
-- up to more than total spending.
create or replace function public.spend_by_tag(p_from date, p_to date)
returns table (tag text, total_paise bigint, txn_count bigint)
language sql
stable
set search_path = ''
as $$
  select g.tag, sum(t.amount_paise)::bigint, count(*)::bigint
  from public.transactions t
  cross join lateral unnest(t.tags) as g(tag)
  where t.user_id = (select auth.uid())
    and t.type = 'expense'
    and t.occurred_on between p_from and p_to
  group by g.tag
  order by sum(t.amount_paise) desc, g.tag;
$$;

-- The user's tags, most used first, for suggestions and the filter row.
create or replace function public.my_tags()
returns table (tag text, uses bigint)
language sql
stable
set search_path = ''
as $$
  select g.tag, count(*)::bigint
  from public.transactions t
  cross join lateral unnest(t.tags) as g(tag)
  where t.user_id = (select auth.uid())
  group by g.tag
  order by count(*) desc, g.tag
  limit 60;
$$;

revoke all on function public.apply_recurring_expenses(date) from public, anon;
revoke all on function public.spend_by_tag(date, date) from public, anon;
revoke all on function public.my_tags() from public, anon;
grant execute on function public.apply_recurring_expenses(date) to authenticated;
grant execute on function public.spend_by_tag(date, date) to authenticated;
grant execute on function public.my_tags() to authenticated;
