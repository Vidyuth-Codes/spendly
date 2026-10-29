import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import type { DailyTotal } from './summary';

/** Per-day expense/income totals for an inclusive range. Days with no activity are absent. */
export function useDailyTotals(range: { from: string; to: string }) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['summary', 'daily', userId, range.from, range.to],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('daily_totals', { p_from: range.from, p_to: range.to });
      if (error) throw error;
      return data as DailyTotal[];
    },
  });
}

export type SpendOverview = { total_expense_paise: number; first_date: string | null };

export function useSpendOverview() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['summary', 'overview', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('spend_overview');
      if (error) throw error;
      return (data as SpendOverview[])[0] ?? { total_expense_paise: 0, first_date: null };
    },
  });
}
