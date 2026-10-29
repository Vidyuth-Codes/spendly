// Money is stored as integer paise everywhere; these helpers are the only place rupees appear.

const AMOUNT_RE = /^(\d{1,9}(\.\d{0,2})?|\.\d{1,2})$/;

/** "1,250.5" -> 125050. Returns null for empty, zero, or malformed input. No floating point involved. */
export function parseRupees(input: string): number | null {
  const s = input.replace(/[,\s₹]/g, '');
  if (!AMOUNT_RE.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const paise = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  return paise > 0 ? paise : null;
}

/** Keeps typed amounts well-formed: digits and one dot, max 2 decimals, max 9 whole digits. */
export function sanitizeAmountInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, 9);
  const whole = cleaned.slice(0, dot).slice(0, 9);
  const frac = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}.${frac}`;
}

/** 125050 -> "1250.50", 25000 -> "250" (for pre-filling the amount input). */
export function paiseToInput(paise: number): string {
  const whole = Math.floor(paise / 100);
  const frac = paise % 100;
  return frac ? `${whole}.${String(frac).padStart(2, '0')}` : String(whole);
}

/** 12345678 -> "₹1,23,456.78" (Indian digit grouping; decimals only when non-zero). */
export function formatPaise(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = String(Math.floor(abs / 100));
  const frac = abs % 100;

  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;

  return `${negative ? '-' : ''}₹${grouped}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
}
