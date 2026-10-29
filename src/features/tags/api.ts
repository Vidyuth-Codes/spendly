import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { monthRange } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type TagUse = { tag: string; uses: number };
export type TagSpend = { tag: string; total_paise: number; txn_count: number };

/** The user's tags, most used first: for suggestions and the filter row. */
export function useMyTags() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['tags', 'mine', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_tags');
      if (error) throw error;
      return (data as { tag: string; uses: number }[]).map((r) => ({ tag: r.tag, uses: Number(r.uses) })) as TagUse[];
    },
  });
}

/** Expense totals per tag between two dates (this month by default). */
export function useSpendByTag(range = monthRange(0)) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['summary', 'spend-by-tag', userId, range.from, range.to],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('spend_by_tag', { p_from: range.from, p_to: range.to });
      if (error) throw error;
      return (data as TagSpend[]).map((r) => ({ ...r, total_paise: Number(r.total_paise), txn_count: Number(r.txn_count) }));
    },
  });
}
