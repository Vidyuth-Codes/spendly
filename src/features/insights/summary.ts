import { addDaysISO, daysBetween } from '@/lib/dates';

export type DailyTotal = { day: string; expense_paise: number; income_paise: number };

export type PeriodSummary = {
  expensePaise: number;
  incomePaise: number;
  /** income - expense */
  netPaise: number;
  /** Days of the period that have happened so far (all of them for a finished period). */
  daysElapsed: number;
  /** Average spend per elapsed day. */
  avgPerDayPaise: number;
  /** One entry per day of the period, zero-filled (feeds the charts in the next task). */
  days: DailyTotal[];
};

const sum = (rows: DailyTotal[], key: 'expense_paise' | 'income_paise') =>
  rows.reduce((total, r) => total + r[key], 0);

/** Days of [from, to] that are not in the future relative to `today`. Never negative. */
export function elapsedDays(range: { from: string; to: string }, today: string): number {
  const last = today < range.to ? today : range.to;
  return Math.max(0, daysBetween(range.from, last) + 1);
}

export function summarizePeriod(rows: DailyTotal[], range: { from: string; to: string }, today: string): PeriodSummary {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const totalDays = daysBetween(range.from, range.to) + 1;
  const days: DailyTotal[] = [];
  for (let i = 0; i < totalDays; i++) {
    const day = addDaysISO(range.from, i);
    days.push(byDay.get(day) ?? { day, expense_paise: 0, income_paise: 0 });
  }

  const daysElapsed = elapsedDays(range, today);
  const expensePaise = sum(days, 'expense_paise');
  const incomePaise = sum(days, 'income_paise');

  return {
    expensePaise,
    incomePaise,
    netPaise: incomePaise - expensePaise,
    daysElapsed,
    avgPerDayPaise: daysElapsed > 0 ? Math.round(expensePaise / daysElapsed) : 0,
    days,
  };
}

/**
 * Change in spending versus the previous period, compared like-for-like: a half-finished month is
 * measured against the same number of days of last month, not against all of it.
 * Returns null when there is nothing to compare against.
 */
export function compareToPrevious(
  current: PeriodSummary,
  previousRows: DailyTotal[],
  previousRange: { from: string },
): { percent: number; previousPaise: number } | null {
  const cutoff = addDaysISO(previousRange.from, current.daysElapsed - 1);
  const previousPaise = previousRows
    .filter((r) => r.day >= previousRange.from && r.day <= cutoff)
    .reduce((total, r) => total + r.expense_paise, 0);
  if (previousPaise === 0 || current.daysElapsed === 0) return null;
  return { percent: Math.round(((current.expensePaise - previousPaise) / previousPaise) * 100), previousPaise };
}

export type Averages = { perDayPaise: number; perWeekPaise: number; perMonthPaise: number; daysTracked: number };

const DAYS_PER_MONTH = 365.25 / 12;

/**
 * All-time average spend, from the first transaction to today. Weekly and monthly figures are the
 * daily average scaled (x7, x30.44), so they stay meaningful before a full week/month of data exists.
 */
export function computeAverages(totalExpensePaise: number, firstDate: string | null, today: string): Averages | null {
  if (!firstDate) return null;
  const daysTracked = Math.max(1, daysBetween(firstDate, today) + 1);
  const perDay = totalExpensePaise / daysTracked;
  return {
    perDayPaise: Math.round(perDay),
    perWeekPaise: Math.round(perDay * 7),
    perMonthPaise: Math.round(perDay * DAYS_PER_MONTH),
    daysTracked,
  };
}
