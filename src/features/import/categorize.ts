import type { TxnType } from '@/features/transactions/api';

export type LearnedRule = { keyword: string; category_id: string };
export type CategoryRef = { id: string; name: string; kind: TxnType };

/** Words in bank descriptions that say how money moved, not who it moved to. */
const NOISE = new Set([
  'upi', 'imps', 'neft', 'rtgs', 'ach', 'ecs', 'nach', 'pos', 'atm', 'txn', 'trf', 'tfr', 'dr', 'cr', 'debit', 'credit',
  'payment', 'paid', 'pay', 'to', 'from', 'by', 'ref', 'refno', 'no', 'transfer', 'trans', 'bank', 'ltd', 'limited', 'pvt',
  'private', 'india', 'the', 'and', 'for', 'via', 'mob', 'mobile', 'net', 'online', 'purchase', 'sent', 'received',
  'okaxis', 'okhdfcbank', 'okicici', 'oksbi', 'ybl', 'ibl', 'axl', 'paytm', 'apl', 'upiqr', 'hdfcbank', 'icici', 'sbi', 'axis',
]);

const isNoiseWord = (w: string) =>
  NOISE.has(w) ||
  /^[\dx*]+$/i.test(w) || // reference numbers and masked card digits
  /^[a-z]{4}0[a-z0-9]{6}$/i.test(w) || // IFSC codes
  w.includes('@') || // UPI handles
  w.length < 3;

/**
 * Finds who a payment went to. "UPI/DR/4123/SWIGGY/okaxis/Order" -> "Swiggy". Returns the readable
 * merchant name and a short lower-case keyword used to recognize the same merchant later.
 */
export function extractPayee(description: string): { merchant: string; keyword: string } | null {
  for (const segment of description.split(/[/|\-,]+/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    const start = words.findIndex((w) => !isNoiseWord(w.toLowerCase()));
    if (start === -1) continue;

    const picked: string[] = [];
    for (const w of words.slice(start)) {
      if (isNoiseWord(w.toLowerCase())) break;
      picked.push(w);
      if (picked.length === 3) break;
    }
    const merchant = picked.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const first = picked[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (first.length >= 3) return { merchant: merchant.slice(0, 80), keyword: first.slice(0, 40) };
  }
  return null;
}

/** Category name -> words that identify it. Matched as whole words, case-insensitively. */
export const DEFAULT_RULES: Record<string, string[]> = {
  Food: ['swiggy', 'zomato', 'dominos', 'pizza', 'mcdonalds', 'mcdonald', 'kfc', 'burger', 'restaurant', 'cafe', 'starbucks', 'chai', 'bakery', 'dhaba', 'eatfit', 'faasos', 'biryani', 'subway'],
  Groceries: ['bigbasket', 'blinkit', 'zepto', 'dmart', 'grocery', 'instamart', 'jiomart', 'supermarket', 'reliance fresh', 'more retail', 'milkbasket', 'nature basket'],
  Travel: ['uber', 'ola', 'rapido', 'irctc', 'redbus', 'metro', 'petrol', 'diesel', 'fuel', 'indigo', 'spicejet', 'airindia', 'makemytrip', 'goibibo', 'fastag', 'namma yatri'],
  Bills: ['airtel', 'jio', 'vodafone', 'vi', 'bsnl', 'electricity', 'bescom', 'broadband', 'recharge', 'gas', 'water bill', 'postpaid', 'dth', 'tatasky', 'insurance', 'rent'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'decathlon', 'lifestyle', 'westside', 'croma', 'tata cliq'],
  Entertainment: ['netflix', 'spotify', 'hotstar', 'prime video', 'bookmyshow', 'youtube', 'sonyliv', 'zee5', 'inox', 'pvr', 'gaana', 'steam'],
  Health: ['pharmacy', 'apollo', 'medplus', 'hospital', 'clinic', '1mg', 'pharmeasy', 'netmeds', 'diagnostic', 'lab', 'dental', 'doctor'],
  Education: ['udemy', 'coursera', 'byju', 'unacademy', 'school', 'college', 'tuition', 'university', 'exam fee', 'course'],
};

const INCOME_RULES: Record<string, string[]> = {
  Salary: ['salary', 'payroll'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(word)}([^a-z0-9]|$)`).test(text);

export function defaultCategoryName(description: string, type: TxnType): string | null {
  const text = description.toLowerCase();
  const rules = type === 'expense' ? DEFAULT_RULES : INCOME_RULES;
  for (const [name, words] of Object.entries(rules)) {
    if (words.some((w) => hasWord(text, w))) return name;
  }
  return null;
}

/**
 * Chooses a category for a transaction: the user's own remembered merchants first (longest match
 * wins), then the built-in keywords mapped onto the user's categories by name.
 */
export function pickCategoryId(
  description: string,
  type: TxnType,
  learned: LearnedRule[],
  categories: CategoryRef[],
): string | null {
  const text = description.toLowerCase();
  const usable = new Map(categories.filter((c) => c.kind === type).map((c) => [c.id, c]));

  const mine = learned
    .filter((r) => usable.has(r.category_id) && text.includes(r.keyword))
    .sort((a, b) => b.keyword.length - a.keyword.length)[0];
  if (mine) return mine.category_id;

  const name = defaultCategoryName(description, type);
  if (!name) return null;
  return categories.find((c) => c.kind === type && c.name.trim().toLowerCase() === name.toLowerCase())?.id ?? null;
}

export type PaymentMethodGuess = 'upi' | 'card' | 'cash' | 'bank';

export function guessPaymentMethod(description: string): PaymentMethodGuess {
  const t = description.toLowerCase();
  if (/\bupi\b/.test(t)) return 'upi';
  if (/\b(pos|card|visa|mastercard)\b/.test(t)) return 'card';
  if (/\b(atm|cash)\b/.test(t)) return 'cash';
  return 'bank';
}
