-- Savings goals (with automatic monthly contributions from income) and month-to-month carry forward.

-- ------------------------------------------------------------------ savings goals
create table public.savings_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  target_paise bigint not null check (target_paise > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);

create trigger savings_goals_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

-- Every rupee put towards a goal, whether added by hand or automatically from an income source.
create table public.goal_contributions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  goal_id          uuid not null,
  amount_paise     bigint not null check (amount_paise > 0),
  contributed_on   date not null default current_date,
  income_source_id uuid references public.income_sources (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete cascade
);

create index goal_contributions_goal on public.goal_contributions (goal_id, contributed_on desc);

-- "Save 2,000 of this 10,000 towards the Mobile goal every month."
alter table public.income_sources
  add column savings_paise bigint not null default 0 check (savings_paise >= 0),
  add column savings_goal_id uuid,
  add constraint income_sources_savings_within_amount check (savings_paise <= amount_paise),
  add foreign key (savings_goal_id, user_id) references public.savings_goals (id, user_id)
    on delete set null (savings_goal_id);

-- ------------------------------------------------------------------ carry forward
alter table public.profiles add column carry_forward boolean not null default false;

-- Snapshot of the balance carried into each month, taken once when the month starts.
create table public.monthly_carry (
  user_id      uuid not null references auth.users (id) on delete cascade,
  month        date not null,  -- first day of the month
  amount_paise bigint not null check (amount_paise >= 0),
  created_at   timestamptz not null default now(),
  primary key (user_id, month)
);

-- ------------------------------------------------------------------------- RLS
alter table public.savings_goals      enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.monthly_carry      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['savings_goals', 'goal_contributions', 'monthly_carry'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || ': own rows', t);
  end loop;
end;
$$;

revoke all on public.savings_goals, public.goal_contributions, public.monthly_carry from anon;

-- ------------------------------------------------------- apply_recurring_income v2
-- Same behaviour as before (once per month, catch-up, day clamping, idempotent), plus: when the
-- source saves towards a goal, that month's contribution is recorded in the same step. A goal
-- never receives more than its target; once it is full, saving from that source stops and the
-- money goes back into the budget.
create or replace function public.apply_recurring_income(p_today date default current_date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  src         record;
  uid         uuid := (select auth.uid());
  this_month  date := date_trunc('month', p_today)::date;
  m           date;
  due         date;
  created     integer := 0;
  allowance   uuid;
  save_paise  bigint;
  save_goal   uuid;
  goal_target bigint;
  goal_saved  bigint;
  room        bigint;
  put         bigint;
begin
  select id into allowance
  from public.categories
  where user_id = uid and kind = 'income' and archived_at is null and lower(btrim(name)) = 'allowance'
  limit 1;

  for src in
    select * from public.income_sources where user_id = uid and active for update
  loop
    save_paise := src.savings_paise;
    save_goal  := src.savings_goal_id;

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

      if save_goal is not null and save_paise > 0 then
        select target_paise into goal_target
        from public.savings_goals where id = save_goal and user_id = uid;

        if goal_target is not null then
          select coalesce(sum(amount_paise), 0) into goal_saved
          from public.goal_contributions where goal_id = save_goal and user_id = uid;

          room := greatest(goal_target - goal_saved, 0);
          put  := least(save_paise, room);

          if put > 0 then
            insert into public.goal_contributions (user_id, goal_id, amount_paise, contributed_on, income_source_id)
            values (src.user_id, save_goal, put, due, src.id);
          end if;

          if room - put <= 0 then  -- goal is full: stop saving from this source
            update public.income_sources set savings_paise = 0, savings_goal_id = null where id = src.id;
            save_paise := 0;
            save_goal  := null;
          end if;
        end if;
      end if;

      update public.income_sources set last_applied_month = m where id = src.id;
      created := created + 1;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  return created;
end;
$$;

-- --------------------------------------------------------------- apply_carry_forward
-- Works out how much of last month's budget was left unspent and stores it as this month's
-- carry, once. Returns this month's carry (0 when carry forward is off).
--   budget for last month = the overall monthly budget, else income minus the money being saved
--   (today's budget is used as last month's; budgets are not versioned)
--   carry = max(0, last month's budget + what was carried into it - what was spent)
-- Nothing is carried in a user's first month: there is no "last month" until they have a
-- transaction dated before this one.
create or replace function public.apply_carry_forward(p_today date default current_date)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  uid        uuid := (select auth.uid());
  this_month date := date_trunc('month', p_today)::date;
  prev_month date := (date_trunc('month', p_today) - interval '1 month')::date;
  enabled    boolean;
  budget     bigint;
  spent      bigint;
  prev_carry bigint;
  leftover   bigint;
begin
  select carry_forward into enabled from public.profiles where id = uid;
  if not coalesce(enabled, false) then
    return 0;
  end if;

  select amount_paise into leftover from public.monthly_carry where user_id = uid and month = this_month;
  if found then
    return leftover;
  end if;

  if not exists (select 1 from public.transactions where user_id = uid and occurred_on < this_month) then
    return 0;
  end if;

  select amount_paise into budget from public.budgets where user_id = uid and category_id is null;
  if budget is null then
    select coalesce(sum(amount_paise - case when savings_goal_id is not null then savings_paise else 0 end), 0)
    into budget
    from public.income_sources where user_id = uid and active;
  end if;
  if budget <= 0 then
    return 0;  -- no budget to measure against yet; try again once one is set
  end if;

  select coalesce(sum(amount_paise), 0) into spent
  from public.transactions
  where user_id = uid and type = 'expense' and occurred_on >= prev_month and occurred_on < this_month;

  -- A scalar subquery so a missing row yields 0; "select ... into" alone would leave NULL, and
  -- greatest(0, NULL) silently returns 0.
  prev_carry := coalesce(
    (select amount_paise from public.monthly_carry where user_id = uid and month = prev_month),
    0
  );

  leftover := greatest(0, budget + prev_carry - spent);

  insert into public.monthly_carry (user_id, month, amount_paise)
  values (uid, this_month, leftover)
  on conflict (user_id, month) do nothing;

  select amount_paise into leftover from public.monthly_carry where user_id = uid and month = this_month;
  return leftover;
end;
$$;

revoke all on function public.apply_recurring_income(date) from public, anon;
revoke all on function public.apply_carry_forward(date) from public, anon;
grant execute on function public.apply_recurring_income(date) to authenticated;
grant execute on function public.apply_carry_forward(date) to authenticated;
