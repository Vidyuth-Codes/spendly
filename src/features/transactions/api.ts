import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { removeReceipts, uploadReceipt } from '@/features/receipts/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type TxnType = 'expense' | 'income';
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'bank' | 'other';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
];

export type Transaction = {
  id: string;
  user_id: string;
  type: TxnType;
  amount_paise: number;
  category_id: string | null;
  merchant: string | null;
  note: string | null;
  payment_method: PaymentMethod;
  occurred_on: string; // YYYY-MM-DD
  /** Set when a recurring expense or income created this transaction. */
  recurring_expense_id: string | null;
  income_source_id: string | null;
  tags: string[];
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
};

/** What to do with the receipt photo when saving. */
export type ReceiptChange =
  | { kind: 'keep' }
  | { kind: 'remove'; previousPath: string }
  | { kind: 'replace'; uri: string; previousPath: string | null };

export type TransactionInput = {
  id?: string;
  type: TxnType;
  amount_paise: number;
  category_id: string | null;
  merchant: string | null;
  note: string | null;
  payment_method: PaymentMethod;
  occurred_on: string;
  tags: string[];
  receipt: ReceiptChange;
};

export type TxnFilters = {
  type?: TxnType;
  categoryId?: string;
  tag?: string;
  from?: string; // inclusive YYYY-MM-DD
  to?: string; // inclusive YYYY-MM-DD
  search?: string;
};

const PAGE_SIZE = 30;

/** Anything that changes transactions must also refresh these. */
const AFFECTED_KEYS = [['transactions'], ['summary']] as const;

/** Newest first, paged. Rows are returned flat; the screen groups them by day. */
export function useTransactions(filters: TxnFilters) {
  const userId = useAuth().session?.user.id;

  return useInfiniteQuery({
    queryKey: ['transactions', 'list', userId, filters],
    enabled: Boolean(userId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filters.type) q = q.eq('type', filters.type);
      if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
      if (filters.tag) q = q.contains('tags', [filters.tag]);
      if (filters.from) q = q.gte('occurred_on', filters.from);
      if (filters.to) q = q.lte('occurred_on', filters.to);

      // Strip characters that are syntax inside a PostgREST .or() filter or ilike pattern.
      const search = filters.search?.replace(/[%,()*\\]/g, ' ').trim();
      if (search) q = q.or(`merchant.ilike.%${search}%,note.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return data as Transaction[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transactions', 'one', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as Transaction;
    },
  });
}

export function useSaveTransaction() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ id, receipt, ...fields }: TransactionInput) => {
      // Upload a new photo first so the row can point at it; if saving then fails, take it back down.
      let uploadedPath: string | null = null;
      const row: Record<string, unknown> = { ...fields };
      if (receipt.kind === 'replace') {
        uploadedPath = await uploadReceipt(userId!, receipt.uri);
        row.receipt_path = uploadedPath;
      } else if (receipt.kind === 'remove') {
        row.receipt_path = null;
      }

      const { error } = id
        ? await supabase.from('transactions').update(row).eq('id', id)
        : await supabase.from('transactions').insert({ ...row, user_id: userId });
      if (error) {
        if (uploadedPath) await removeReceipts([uploadedPath]);
        throw error;
      }

      // The old file is only deleted once the row no longer points at it.
      const previous = receipt.kind === 'keep' ? null : receipt.previousPath;
      if (previous) await removeReceipts([previous]);
    },
    onSuccess: () =>
      Promise.all([
        ...AFFECTED_KEYS.map((k) => client.invalidateQueries({ queryKey: k })),
        client.invalidateQueries({ queryKey: ['tags'] }),
      ]),
  });
}

export function useDeleteTransaction() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, receiptPath }: { id: string; receiptPath: string | null }) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      if (receiptPath) await removeReceipts([receiptPath]);
    },
    onSuccess: () =>
      Promise.all([
        ...AFFECTED_KEYS.map((k) => client.invalidateQueries({ queryKey: k })),
        client.invalidateQueries({ queryKey: ['tags'] }),
      ]),
  });
}
