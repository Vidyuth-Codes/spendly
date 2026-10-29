import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import type { Loan, LoanDirection } from './balances';

/** Every loan with its repayments. Open ones are sorted first by the screens. */
export function useLoans() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['loans', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*, payments:loan_payments(id, amount_paise, paid_on, created_at)')
        .order('occurred_on', { ascending: false });
      if (error) throw error;
      return (data as Loan[]).map((l) => ({
        ...l,
        payments: [...l.payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at)),
      }));
    },
  });
}

export type LoanInput = {
  id?: string;
  person: string;
  direction: LoanDirection;
  amountPaise: number;
  note: string | null;
  date: string;
};

export function useSaveLoan() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ id, person, direction, amountPaise, note, date }: LoanInput) => {
      const fields = { person: person.trim(), direction, amount_paise: amountPaise, note, occurred_on: date };
      const { error } = id
        ? await supabase.from('loans').update(fields).eq('id', id)
        : await supabase.from('loans').insert({ ...fields, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useDeleteLoan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useAddLoanPayment() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ loanId, amountPaise, date }: { loanId: string; amountPaise: number; date?: string }) => {
      const { error } = await supabase
        .from('loan_payments')
        .insert({ user_id: userId, loan_id: loanId, amount_paise: amountPaise, paid_on: date ?? todayISO() });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useDeleteLoanPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loan_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['loans'] }),
  });
}
