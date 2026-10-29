-- Task 7: aggregates for the Insights tab. Both run as the caller, so RLS applies.

-- Per-day expense and income totals over an inclusive date range (days with no activity are
-- omitted; the app fills them in as zero). Weekly/monthly views are built from these rows.
create or replace function public.daily_totals(p_from date, p_to date)
returns table (day date, expense_paise bigint, income_paise bigint)
language sql
stabler
set search_path = ''
as $$
  select
    t.occurred_on,
    coalesce(sum(t.amount_paise) filter (where t.type = 'expense'), 0)::bigint,
    coalesce(sum(t.amount_paise) filter (where t.type = 'income'), 0)::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to
  group by t.occurred_on
  order by t.occurred_on;
$$;

-- All-time expense total and the date of the user's first transaction, for average
-- spend per day / week / month.
create or replace function public.spend_overview()
returns table (total_expense_paise bigint, first_date date)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(t.amount_paise) filter (where t.type = 'expense'), 0)::bigint,
    min(t.occurred_on)
  from public.transactions t
  where t.user_id = (select auth.uid());
$$;

revoke all on function public.daily_totals(date, date) from public, anon;
revoke all on function public.spend_overview() from public, anon;
grant execute on function public.daily_totals(date, date) to authenticated;
grant execute on function public.spend_overview() to authenticated;
