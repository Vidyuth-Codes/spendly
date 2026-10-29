import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { PaymentMethod } from '@/features/transactions/api';
import { useAuth } from '@/lib/auth';
import { todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type RecurringExpense = {
  id: string;
  name: string;
  amount_paise: number;
  category_id: string | null;
  payment_method: PaymentMethod;
  day_of_month: number;
  active: boolean;
  last_applied_month: string | null;
};

export type RecurringExpenseInput = Omit<RecurringExpense, 'id' | 'last_applied_month'> & { id?: string };

const refreshMoney = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ['transactions'] }),
    client.invalidateQueries({ queryKey: ['summary'] }),
  ]);

/** Adds every recurring expense that is due (safe to call repeatedly), then refreshes money screens. */
export async function applyRecurringExpenses(client: QueryClient) {
  const { data, error } = await supabase.rpc('apply_recurring_expenses', { p_today: todayISO() });
  if (error) throw error;
  if ((data as number) > 0) await refreshMoney(client);
  return data as number;
}

export function useRecurringExpenses() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['recurring_expenses', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('recurring_expenses').select('*').order('created_at');
      if (error) throw error;
      return data as RecurringExpense[];
    },
  });
}

export function useSaveRecurringExpense() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ id, ...fields }: RecurringExpenseInput) => {
      const { error } = id
        ? await supabase.from('recurring_expenses').update(fields).eq('id', id)
        : await supabase.from('recurring_expenses').insert({ ...fields, user_id: userId });
      if (error) throw error;
      // If this month's due day has already passed, add it straight away.
      await applyRecurringExpenses(client);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['recurring_expenses'] }),
  });
}

export function useDeleteRecurringExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Transactions it already created stay (their link is cleared by the database).
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['recurring_expenses'] }),
  });
}
