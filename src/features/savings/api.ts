import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import type { SavingsGoal } from './progress';

/** Goals with all of their contributions, oldest goal first. Progress is computed from these. */
export function useGoals() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['goals', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*, contributions:goal_contributions(id, amount_paise, contributed_on, income_source_id, created_at)')
        .order('created_at');
      if (error) throw error;
      return (data as SavingsGoal[]).map((g) => ({
        ...g,
        contributions: [...g.contributions].sort(
          (a, b) => b.contributed_on.localeCompare(a.contributed_on) || b.created_at.localeCompare(a.created_at),
        ),
      }));
    },
  });
}

function useRefreshGoals() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['goals'] }),
      client.invalidateQueries({ queryKey: ['income_sources'] }), // deleting a goal detaches its sources
    ]);
}

export function useSaveGoal() {
  const userId = useAuth().session?.user.id;
  const refresh = useRefreshGoals();

  return useMutation({
    mutationFn: async ({ id, name, targetPaise }: { id?: string; name: string; targetPaise: number }) => {
      const fields = { name: name.trim(), target_paise: targetPaise };
      const { error } = id
        ? await supabase.from('savings_goals').update(fields).eq('id', id)
        : await supabase.from('savings_goals').insert({ ...fields, user_id: userId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteGoal() {
  const refresh = useRefreshGoals();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

/** Put money towards a goal by hand (automatic monthly contributions come from income sources). */
export function useAddContribution() {
  const userId = useAuth().session?.user.id;
  const refresh = useRefreshGoals();

  return useMutation({
    mutationFn: async ({ goalId, amountPaise, date }: { goalId: string; amountPaise: number; date?: string }) => {
      const { error } = await supabase.from('goal_contributions').insert({
        user_id: userId,
        goal_id: goalId,
        amount_paise: amountPaise,
        contributed_on: date ?? todayISO(),
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteContribution() {
  const refresh = useRefreshGoals();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goal_contributions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
