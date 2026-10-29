import type { Mapping } from './columns';

export type ParsedRow = {
  /** 0-based index into the CSV rows, for error messages. */
  rowIndex: number;
  date: string; // YYYY-MM-DD
  type: 'expense' | 'income';
  amountPaise: number;
  description: string;
};

export type BadRow = { rowIndex: number; reason: string; raw: string[] };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(y, m, 0).getDate();
  if (d > last) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Reads the date formats banks use, ignoring any time of day. Returns YYYY-MM-DD or null. */
export function parseDate(input: string, dayFirst = true): string | null {
  const s = input.trim().replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(am|pm)?(z|[+-]\d{2}:?\d{2})?$/i, '').trim();

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return dayFirst ? validDate(year, +m[2], +m[1]) : validDate(year, +m[1], +m[2]);
  }

  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ,]*(\d{2}|\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3).toLowerCase()];
    if (!month) return null;
    return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], month, +m[1]);
  }
  return null;
}

export type ParsedAmount = { paise: number; negative: boolean; suffix: 'dr' | 'cr' | null };

const MAX_PAISE = 99_999_999_999; // 999,999,999.99

/** "₹1,250.50", "(500)", "-500.00", "500.00 Dr" -> paise plus sign info. Null if not a number. */
export function parseAmount(input: string): ParsedAmount | null {
  let s = input.trim();
  if (!s) return null;

  let suffix: 'dr' | 'cr' | null = null;
  const sfx = s.match(/\s*(dr|cr)\.?$/i);
  if (sfx) {
    suffix = sfx[1].toLowerCase() as 'dr' | 'cr';
    s = s.slice(0, sfx.index).trim();
  }

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^(rs\.?|inr|₹)\s*/i, '').replace(/[,\s₹]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const paise = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  if (paise > MAX_PAISE) return null;
  return { paise, negative, suffix };
}

const DEBIT_WORD = /^(dr|debit|d|w|wd|withdrawal|out|paid|expense)/i;
const CREDIT_WORD = /^(cr|credit|c|deposit|in|received|income)/i;

const cellAt = (row: string[], col: number) => (col >= 0 ? (row[col] ?? '').trim() : '');
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Turns CSV rows into transactions using the chosen mapping. Rows that cannot be read are returned with a reason. */
export function normalizeRows(
  rows: string[][],
  headerIndex: number,
  m: Mapping,
): { good: ParsedRow[]; bad: BadRow[] } {
  const good: ParsedRow[] = [];
  const bad: BadRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const fail = (reason: string) => bad.push({ rowIndex: i, reason, raw: row });

    const dateText = cellAt(row, m.dateCol);
    const date = parseDate(dateText, m.dayFirst);
    if (!date) {
      fail(dateText ? `Unreadable date "${dateText}"` : 'No date');
      continue;
    }

    let type: 'expense' | 'income' | null = null;
    let paise = 0;

    if (m.amountMode === 'split') {
      const debit = m.debitCol >= 0 ? parseAmount(cellAt(row, m.debitCol)) : null;
      const credit = m.creditCol >= 0 ? parseAmount(cellAt(row, m.creditCol)) : null;
      const d = debit && debit.paise > 0 ? debit : null;
      const c = credit && credit.paise > 0 ? credit : null;
      if (d && c) {
        fail('Has both a debit and a credit amount');
        continue;
      }
      if (d) [type, paise] = ['expense', d.paise];
      else if (c) [type, paise] = ['income', c.paise];
      else {
        fail('No amount');
        continue;
      }
    } else {
      const amount = parseAmount(cellAt(row, m.amountCol));
      if (!amount || amount.paise === 0) {
        fail(cellAt(row, m.amountCol) ? `Unreadable amount "${cellAt(row, m.amountCol)}"` : 'No amount');
        continue;
      }
      paise = amount.paise;

      if (m.amountMode === 'typed') {
        const t = cellAt(row, m.typeCol);
        type = DEBIT_WORD.test(t) ? 'expense' : CREDIT_WORD.test(t) ? 'income' : null;
        if (!type) {
          fail(`Unknown debit/credit value "${t}"`);
          continue;
        }
      } else if (amount.suffix) {
        type = amount.suffix === 'dr' ? 'expense' : 'income';
      } else {
        const isExpense = m.flipSign ? !amount.negative : amount.negative;
        type = isExpense ? 'expense' : 'income';
      }
    }

    good.push({ rowIndex: i, date, type, amountPaise: paise, description: tidy(cellAt(row, m.descCol)) });
  }
  return { good, bad };
}

/** Lower-cased alphanumeric form of a description, used for fingerprints and matching. */
export function descriptionKey(description: string): string {
  return description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
}

/**
 * A fingerprint per row so importing the same statement twice adds nothing. Identical rows within
 * one file (two ₹50 teas at the same stall on the same day) get an occurrence number, so both are
 * kept the first time yet still match up exactly on a re-import.
 */
export function assignKeys<T extends Pick<ParsedRow, 'date' | 'type' | 'amountPaise' | 'description'>>(
  rows: T[],
): (T & { key: string })[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.date}|${r.type}|${r.amountPaise}|${descriptionKey(r.description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, key: `${base}|${n}` };
  });
}
