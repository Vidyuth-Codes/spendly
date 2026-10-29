import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { monthRange, todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import { applyCarryForward } from './carry';

// ----------------------------------------------------------------- income sources

export type IncomeSource = {
  id: string;
  user_id: string;
  name: string;
  amount_paise: number;
  day_of_month: number;
  active: boolean;
  last_applied_month: string | null;
  /** Part of each month's income set aside for a goal (0 = none). */
  savings_paise: number;
  savings_goal_id: string | null;
};

export type IncomeSourceInput = {
  id?: string;
  name: string;
  amount_paise: number;
  day_of_month: number;
  active: boolean;
  savings_paise: number;
  savings_goal_id: string | null;
};

const refreshMoney = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ['transactions'] }),
    client.invalidateQueries({ queryKey: ['summary'] }),
    client.invalidateQueries({ queryKey: ['goals'] }), // monthly savings are added to goals with the income
    client.invalidateQueries({ queryKey: ['income_sources'] }), // a full goal stops the saving
  ]);

/** Credits every recurring income that is due (idempotent on the server), then refreshes money queries. */
export async function applyRecurringIncome(client: ReturnType<typeof useQueryClient>) {
  const { data, error } = await supabase.rpc('apply_recurring_income', { p_today: todayISO() });
  if (error) throw error;
  if (data > 0) await refreshMoney(client);
  return data as number;
}

export function useIncomeSources() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['income_sources', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('income_sources').select('*').order('created_at');
      if (error) throw error;
      return data as IncomeSource[];
    },
  });
}

export function useSaveIncomeSource() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ id, ...fields }: IncomeSourceInput) => {
      const { error } = id
        ? await supabase.from('income_sources').update(fields).eq('id', id)
        : await supabase.from('income_sources').insert({ ...fields, user_id: userId });
      if (error) throw error;
      // If this month's payday has already passed, credit it right away.
      await applyRecurringIncome(client);
      // The budget may now come from this income, so carry-forward can finally be worked out.
      await applyCarryForward(client).catch(() => {});
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['income_sources'] }),
  });
}

export function useDeleteIncomeSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Past income transactions stay (their income_source_id is set to null by the FK).
      const { error } = await supabase.from('income_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['income_sources'] }),
  });
}

// ---------------------------------------------------------------------- budgets

export type Budget = {
  id: string;
  user_id: string;
  /** null = the overall monthly budget */
  category_id: string | null;
  amount_paise: number;
};

export function useBudgets() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['budgets', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets').select('*');
      if (error) throw error;
      return data as Budget[];
    },
  });
}

/** Set (amountPaise > 0) or clear (null) a limit. categoryId null = overall monthly budget. */
export function useSetBudget() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ categoryId, amountPaise }: { categoryId: string | null; amountPaise: number | null }) => {
      const find = supabase.from('budgets').select('id').eq('user_id', userId!);
      const { data: existing, error: findError } = await (categoryId
        ? find.eq('category_id', categoryId)
        : find.is('category_id', null)
      ).maybeSingle();
      if (findError) throw findError;

      if (amountPaise === null) {
        if (existing) {
          const { error } = await supabase.from('budgets').delete().eq('id', existing.id);
          if (error) throw error;
        }
      } else if (existing) {
        const { error } = await supabase.from('budgets').update({ amount_paise: amountPaise }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert({ user_id: userId, category_id: categoryId, amount_paise: amountPaise });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['budgets'] });
      await applyCarryForward(client).catch(() => {}); // a first budget lets last month's leftover be measured
    },
  });
}

// ------------------------------------------------------------------------ spend

export type CategorySpend = { category_id: string | null; total_paise: number };

/** Expense totals per category between two inclusive dates (this month by default). */
export function useSpendByCategory(range = monthRange(0)) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['summary', 'spend-by-category', userId, range.from, range.to],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('spend_by_category', { p_from: range.from, p_to: range.to });
      if (error) throw error;
      return data as CategorySpend[];
    },
  });
}
