import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PaymentMethod, TxnType } from '@/features/transactions/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import type { LearnedRule } from './categorize';
import type { Mapping } from './columns';

// ------------------------------------------------------------ remembered merchants

export function useMerchantRules() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['merchant_rules', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('merchant_rules').select('keyword, category_id');
      if (error) throw error;
      return data as LearnedRule[];
    },
  });
}

// ------------------------------------------------------ remembered column mappings

const mappingStorageKey = (key: string) => `spendly.import-mapping.${key}`;

/** The mapping the user confirmed last time for a statement with these exact headers. */
export async function loadSavedMapping(key: string): Promise<Mapping | null> {
  try {
    const raw = await AsyncStorage.getItem(mappingStorageKey(key));
    return raw ? (JSON.parse(raw) as Mapping) : null;
  } catch {
    return null;
  }
}

export async function saveMapping(key: string, mapping: Mapping): Promise<void> {
  try {
    await AsyncStorage.setItem(mappingStorageKey(key), JSON.stringify(mapping));
  } catch {
    // remembering is a convenience; ignore storage failures
  }
}

// --------------------------------------------------------- existing data (duplicates)

export type ExistingTransactions = {
  /** import_hash values already stored: these rows were imported before. */
  hashes: Set<string>;
  /** "date|type|amount" of transactions entered by hand, to flag likely duplicates. */
  manual: Set<string>;
};

const PAGE = 1000;

/** Everything already stored between two dates, for duplicate detection. */
export async function fetchExisting(from: string, to: string): Promise<ExistingTransactions> {
  const hashes = new Set<string>();
  const manual = new Set<string>();

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('occurred_on, type, amount_paise, import_hash')
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on')
      .order('id')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;

    for (const t of data) {
      if (t.import_hash) hashes.add(t.import_hash as string);
      else manual.add(`${t.occurred_on}|${t.type}|${t.amount_paise}`);
    }
    if (data.length < PAGE) break;
  }
  return { hashes, manual };
}

// ------------------------------------------------------------------------ import

export type ImportRow = {
  key: string;
  date: string;
  type: TxnType;
  amountPaise: number;
  description: string;
  merchant: string | null;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
};

const CHUNK = 500;

export function useImportTransactions() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;

  return useMutation({
    mutationFn: async ({ rows, learn }: { rows: ImportRow[]; learn: Map<string, string> }) => {
      let inserted = 0;

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({
          user_id: userId,
          type: r.type,
          amount_paise: r.amountPaise,
          category_id: r.categoryId,
          merchant: r.merchant ? r.merchant.slice(0, 80) : null,
          note: r.description ? r.description.slice(0, 280) : null,
          payment_method: r.paymentMethod,
          occurred_on: r.date,
          import_hash: r.key,
        }));
        // Rows whose fingerprint already exists are skipped by the database, so a re-imported
        // statement (or two devices importing at once) can never create duplicates.
        const { data, error } = await supabase
          .from('transactions')
          .upsert(chunk, { onConflict: 'user_id,import_hash', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;
        inserted += data.length;
      }

      if (learn.size > 0) {
        const rules = [...learn].map(([keyword, category_id]) => ({ user_id: userId, keyword, category_id }));
        const { error } = await supabase.from('merchant_rules').upsert(rules, { onConflict: 'user_id,keyword' });
        if (error) throw error;
      }

      return { inserted, skipped: rows.length - inserted };
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['transactions'] }),
        client.invalidateQueries({ queryKey: ['summary'] }),
        client.invalidateQueries({ queryKey: ['merchant_rules'] }),
      ]),
  });
}
