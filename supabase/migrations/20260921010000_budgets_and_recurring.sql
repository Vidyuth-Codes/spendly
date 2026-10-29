-- Task 6: recurring income (allowance) + spend aggregation for budgets.

-- Link auto-created income transactions back to the source that produced them.
alter table public.transactions
  add column income_source_id uuid references public.income_sources (id) on delete set null;

-- --------------------------------------------------------------------------
-- apply_recurring_income
-- Materializes each active income source into an income transaction once per month.
--  * Runs as the caller (security invoker), so RLS still applies.
--  * `for update` serializes concurrent calls (two devices opening the app), and
--    last_applied_month makes it idempotent, so a month is never credited twice.
--  * Catches up on months missed while the app was closed (max 12).
--  * Months are credited on day_of_month, clamped to the month's last day (31 -> Feb 28).
--  * p_today is the caller's local date, so a user in IST is not a day late.
-- Returns how many transactions were created.
-- --------------------------------------------------------------------------
create or replace function public.apply_recurring_income(p_today date default current_date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  src         record;
  this_month  date := date_trunc('month', p_today)::date;
  m           date;
  due         date;
  created     integer := 0;
  allowance   uuid;
begin
  select id into allowance
  from public.categories
  where user_id = (select auth.uid())
    and kind = 'income'
    and archived_at is null
    and lower(btrim(name)) = 'allowance'
  limit 1;

  for src in
    select * from public.income_sources
    where user_id = (select auth.uid()) and active
    for update
  loop
    -- First month still owed: the month after the last one applied.
    -- A brand-new source (never applied) starts at the current month: no backfilled history.
    m := case
      when src.last_applied_month is null then this_month
      else (src.last_applied_month + interval '1 month')::date
    end;
    m := greatest(m, (this_month - interval '11 months')::date);

    while m <= this_month loop
      due := least(m + (src.day_of_month - 1), (m + interval '1 month - 1 day')::date);
      exit when due > p_today;

      insert into public.transactions
        (user_id, type, amount_paise, category_id, merchant, payment_method, occurred_on, income_source_id)
      values
        (src.user_id, 'income', src.amount_paise, allowance, src.name, 'other', due, src.id);

      update public.income_sources set last_applied_month = m where id = src.id;
      created := created + 1;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  return created;
end;
$$;

-- --------------------------------------------------------------------------
-- spend_by_category: expense totals per category over an inclusive date range.
-- category_id is NULL for uncategorized spending. (Aggregates are done in SQL so the
-- app never downloads every transaction just to add them up.)
-- --------------------------------------------------------------------------
create or replace function public.spend_by_category(p_from date, p_to date)
returns table (category_id uuid, total_paise bigint)
language sql
stable
set search_path = ''
as $$
  select t.category_id, sum(t.amount_paise)::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type = 'expense'
    and t.occurred_on between p_from and p_to
  group by t.category_id;
$$;

revoke all on function public.apply_recurring_income(date) from public, anon;
revoke all on function public.spend_by_category(date, date) from public, anon;
grant execute on function public.apply_recurring_income(date) to authenticated;
grant execute on function public.spend_by_category(date, date) to authenticated;
