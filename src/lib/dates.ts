// Transactions use plain calendar dates ("YYYY-MM-DD") in the user's local time, never timestamps,
// so "today" and daily/weekly grouping can't shift with timezones.

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISODate(new Date());

export function addDaysISO(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Inclusive first/last day of a month; offset 0 = this month, -1 = last month. */
export function monthRange(offset = 0, now = new Date()): { from: string; to: string } {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: toISODate(first), to: toISODate(last) };
}

/** "Today", "Yesterday", "Mon, 15 Sep" (year appended when not the current year). */
export function dayLabel(iso: string, now = new Date()): string {
  const today = toISODate(now);
  if (iso === today) return 'Today';
  if (iso === addDaysISO(today, -1)) return 'Yesterday';
  const d = fromISODate(iso);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "Sep 2026": the compact month label for tight spaces. */
export function shortMonthLabel(now = new Date()): string {
  return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/** Inclusive Monday-to-Sunday week; offset 0 = this week, -1 = last week. */
export function weekRange(offset = 0, now = new Date()): { from: string; to: string } {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday + offset * 7);
  const from = toISODate(monday);
  return { from, to: addDaysISO(from, 6) };
}

export type PeriodKind = 'week' | 'month';

export const periodRange = (kind: PeriodKind, offset = 0, now = new Date()) =>
  kind === 'week' ? weekRange(offset, now) : monthRange(offset, now);

/** Whole days from a to b (b - a), calendar-based so DST cannot skew it. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "September 2026" or "15 – 21 Sep" (with months when a week spans two). */
export function periodLabel(kind: PeriodKind, range: { from: string; to: string }): string {
  const from = fromISODate(range.from);
  if (kind === 'month') return `${MONTHS_LONG[from.getMonth()]} ${from.getFullYear()}`;
  const to = fromISODate(range.to);
  const sameMonth = from.getMonth() === to.getMonth();
  return sameMonth
    ? `${from.getDate()} – ${to.getDate()} ${MONTHS[to.getMonth()]}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]} – ${to.getDate()} ${MONTHS[to.getMonth()]}`;
}
