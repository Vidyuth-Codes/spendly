import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Transaction } from '@/features/transactions/api';
import { todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import { neutralizeFormula, toCsv } from './csv';

const PAGE = 1000;
const HEADER = ['Date', 'Type', 'Amount', 'Category', 'Merchant', 'Payment method', 'Note', 'Tags'];

/** 125050 -> "1250.50". Integer maths, no floating point. */
const rupees = (paise: number) => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;

/** Builds the export CSV. Text fields are neutralized so a hostile merchant name cannot run as a formula. */
export function buildExportCsv(rows: Transaction[], categoryName: (id: string | null) => string): string {
  return toCsv([
    HEADER,
    ...rows.map((t) => [
      t.occurred_on,
      t.type,
      rupees(t.amount_paise),
      neutralizeFormula(categoryName(t.category_id)),
      neutralizeFormula(t.merchant ?? ''),
      t.payment_method,
      neutralizeFormula(t.note ?? ''),
      t.tags.map((tag) => `#${tag}`).join(' '),
    ]),
  ]);
}

/**
 * Writes the user's transactions (optionally within a date range) to a CSV file and opens the
 * share sheet. Returns how many rows were exported; 0 means there was nothing to export.
 */
export async function exportTransactionsCsv(range?: { from: string; to: string }): Promise<number> {
  const { data: cats, error: catError } = await supabase.from('categories').select('id, name');
  if (catError) throw catError;
  const names = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));

  const all: Transaction[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from('transactions')
      .select('*')
      .order('occurred_on', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (range) q = q.gte('occurred_on', range.from).lte('occurred_on', range.to);

    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data as Transaction[]));
    if (data.length < PAGE) break;
  }
  if (all.length === 0) return 0;

  const csv = buildExportCsv(all, (id) => (id ? (names.get(id) ?? '') : ''));
  const file = new File(Paths.cache, `spendly-transactions-${todayISO()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
  return all.length;
}
