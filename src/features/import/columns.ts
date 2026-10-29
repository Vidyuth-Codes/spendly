export type AmountMode = 'split' | 'signed' | 'typed';

/** Which column means what. Column indexes are 0-based; -1 = not used. */
export type Mapping = {
  dateCol: number;
  descCol: number;
  /** split: separate debit/credit columns. signed: one amount column, sign gives direction.
   *  typed: one amount column plus a Dr/Cr column. */
  amountMode: AmountMode;
  debitCol: number;
  creditCol: number;
  amountCol: number;
  typeCol: number;
  /** signed mode only: treat positive numbers as expenses (some apps export that way). */
  flipSign: boolean;
  /** 05/09/2026 means 5 September (India, UK) rather than May 9 (US). */
  dayFirst: boolean;
};

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();

const has = (header: string, re: RegExp) => re.test(clean(header));

const DATE_SCORES: [RegExp, number][] = [
  [/^(txn|transaction|trans|tran) date$/, 4],
  [/^date$/, 3],
  [/\bdate\b/, 2],
];

const DESC_ORDER = [
  /narration/,
  /description/,
  /particulars/,
  /transaction remarks|remarks/,
  /details/,
  /payee|merchant|memo|reference/,
  /\b(notes?|title|item|name)\b/, // budgeting apps
];

const TYPE_RE = /^(dr ?\/ ?cr|cr ?\/ ?dr|debit ?\/ ?credit|credit ?\/ ?debit|type|txn type|transaction type|dr cr|cr dr)$/;
const DEBIT_RE = /(withdraw|debit|\bdr\b|paid out|money out|outflow|spent)/;
const CREDIT_RE = /(deposit|credit|\bcr\b|paid in|money in|inflow|received)/;

function pickBest(headers: string[], scorer: (h: string) => number): number {
  let best = -1;
  let bestScore = 0;
  headers.forEach((h, i) => {
    const s = scorer(h);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/** Fills a Mapping from header names. Everything is a guess the user can correct. */
export function guessMapping(headers: string[]): Mapping {
  const dateCol = pickBest(headers, (h) => {
    if (has(h, /value date|posting date|closing/)) return 1;
    return DATE_SCORES.find(([re]) => re.test(clean(h)))?.[1] ?? 0;
  });
  const descCol = pickBest(headers, (h) => {
    const i = DESC_ORDER.findIndex((re) => re.test(clean(h)));
    return i === -1 ? 0 : DESC_ORDER.length - i;
  });
  const typeCol = pickBest(headers, (h) => (TYPE_RE.test(clean(h)) ? 1 : 0));
  const notBalance = (h: string) => !has(h, /balance|bal\b/);
  const debitCol = pickBest(headers, (h) => (notBalance(h) && !TYPE_RE.test(clean(h)) && DEBIT_RE.test(clean(h)) ? 1 : 0));
  const creditCol = pickBest(headers, (h) => (notBalance(h) && !TYPE_RE.test(clean(h)) && CREDIT_RE.test(clean(h)) ? 1 : 0));
  const amountCol = pickBest(headers, (h) =>
    notBalance(h) && !TYPE_RE.test(clean(h)) && has(h, /\b(amount|amt|value)\b/) && !has(h, /date/) ? 1 : 0,
  );

  const amountMode: AmountMode =
    debitCol >= 0 || creditCol >= 0 ? (amountCol >= 0 && debitCol < 0 && creditCol < 0 ? 'signed' : 'split') : amountCol >= 0 && typeCol >= 0 ? 'typed' : 'signed';

  return {
    dateCol,
    descCol,
    amountMode,
    debitCol: amountMode === 'split' ? debitCol : -1,
    creditCol: amountMode === 'split' ? creditCol : -1,
    amountCol: amountMode === 'split' ? -1 : amountCol,
    typeCol: amountMode === 'typed' ? typeCol : -1,
    flipSign: false,
    dayFirst: true,
  };
}

/**
 * Bank statements often start with account details before the real header. The header is the first
 * row (in the top 40) that has a date-like column and an amount-like column.
 */
export function detectHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i];
    if (cells.filter((c) => c).length < 3) continue;
    const dateLike = cells.some((c) => has(c, /\bdate\b/));
    const amountLike = cells.some((c) => has(c, /(amount|amt|debit|credit|withdraw|deposit|\bdr\b|\bcr\b)/));
    if (dateLike && amountLike) return i;
  }
  return 0;
}

/** Stable identity for a statement layout, so a saved mapping is reused for the same bank. */
export function mappingKey(headers: string[]): string {
  return headers.map(clean).join('|').slice(0, 300);
}

/** True when the mapping has enough to produce transactions. */
export function isMappingUsable(m: Mapping): boolean {
  if (m.dateCol < 0) return false;
  if (m.amountMode === 'split') return m.debitCol >= 0 || m.creditCol >= 0;
  if (m.amountMode === 'typed') return m.amountCol >= 0 && m.typeCol >= 0;
  return m.amountCol >= 0;
}
