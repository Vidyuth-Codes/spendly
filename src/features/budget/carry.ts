import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { monthRange, todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

/**
 * Whether last month's leftover is added to this month's budget. Stored on the profile so the
 * server function that snapshots the carry can read it.
 */
export function useCarryEnabled() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['profile', userId, 'carry_forward'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('carry_forward').eq('id', userId!).single();
      if (error) throw error;
      return Boolean(data.carry_forward);
    },
  });
}

/** The amount carried into the current month (0 if none has been calculated yet). */
export function useCarryAmount() {
  const userId = useAuth().session?.user.id;
  const month = monthRange(0).from; // first day of this month
  return useQuery({
    queryKey: ['carry', userId, month],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('monthly_carry').select('amount_paise').eq('month', month).maybeSingle();
      if (error) throw error;
      return (data?.amount_paise as number | undefined) ?? 0;
    },
  });
}

/** Asks the server to snapshot this month's carry if it has not been done yet (idempotent). */
export async function applyCarryForward(client: QueryClient) {
  const { data, error } = await supabase.rpc('apply_carry_forward', { p_today: todayISO() });
  if (error) throw error;
  await client.invalidateQueries({ queryKey: ['carry'] });
  return data as number;
}

export function useSetCarryForward() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('profiles').update({ carry_forward: enabled }).eq('id', userId!);
      if (error) throw error;
      if (enabled) await applyCarryForward(client);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['profile'] }),
  });
}
