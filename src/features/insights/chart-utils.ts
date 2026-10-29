// Pure helpers behind the charts (kept free of React so they are easy to test).

export type Slice = { key: string; label: string; value: number; color: string };

export const OTHERS_COLOR = '#B0B4BA';
export const UNCATEGORIZED_COLOR = '#8E8E93';

/**
 * Sorts slices largest-first and folds everything beyond `max - 1` into one "Others" slice, so the
 * donut never has a dozen unreadable slivers. Zero-value slices are dropped.
 */
export function groupSlices(slices: Slice[], max = 6): Slice[] {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1);
  return [...head, { key: 'others', label: 'Others', value: rest.reduce((t, s) => t + s.value, 0), color: OTHERS_COLOR }];
}

/** Running total: [3, 0, 2] -> [3, 3, 5]. */
export function cumulative(values: number[]): number[] {
  let total = 0;
  return values.map((v) => (total += v));
}

/** Rounds an axis maximum up to 1, 2, 5 or 10 times a power of ten. Never returns 0. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const n = value / magnitude;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * magnitude;
}

/** Short money for axis labels, Indian style: 950 -> ₹950, 12500 -> ₹12.5k, 250000 -> ₹2.5L. */
export function formatCompactPaise(paise: number): string {
  const rupees = paise / 100;
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (rupees < 1000) return `₹${Math.round(rupees)}`;
  if (rupees < 100_000) return `₹${trim(rupees / 1000)}k`;
  if (rupees < 10_000_000) return `₹${trim(rupees / 100_000)}L`;
  return `₹${trim(rupees / 10_000_000)}Cr`;
}
