export type SafeToSpend = {
  budgetPaise: number;
  spentPaise: number;
  /** Can be negative when over budget. */
  remainingPaise: number;
  /** Days left in the month including today. */
  daysLeft: number;
  /** What you can spend per remaining day; 0 once the budget is used up. */
  perDayPaise: number;
  /** spent / budget, uncapped (1.2 = 20% over). */
  ratio: number;
  status: 'ok' | 'warning' | 'over';
};

/**
 * "Safe to spend today" for a monthly budget: what's left, spread evenly over the days remaining
 * (today included, so on the last day the whole remainder is available).
 */
export function computeSafeToSpend(budgetPaise: number, spentPaise: number, today = new Date()): SafeToSpend {
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate() + 1;
  const remainingPaise = budgetPaise - spentPaise;
  const ratio = budgetPaise > 0 ? spentPaise / budgetPaise : 0;

  return {
    budgetPaise,
    spentPaise,
    remainingPaise,
    daysLeft,
    perDayPaise: remainingPaise > 0 ? Math.floor(remainingPaise / daysLeft) : 0,
    ratio,
    status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok',
  };
}

/** Status for a single category limit, same thresholds as the overall budget. */
export const limitStatus = (spentPaise: number, limitPaise: number): SafeToSpend['status'] => {
  const ratio = limitPaise > 0 ? spentPaise / limitPaise : 0;
  return ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok';
};
