export type BudgetSource = {
  amount_paise: number;
  active: boolean;
  savings_paise: number;
  savings_goal_id: string | null;
};

export type MonthlyBudget = {
  /** The budget before any carry-forward. 0 when nothing is set up. */
  basePaise: number;
  /** Last month's leftover added to this month (0 unless carry forward is on). */
  carryPaise: number;
  /** basePaise + carryPaise: what Home measures spending against. 0 when there is no budget. */
  totalPaise: number;
  /** True when the base comes from income rather than a budget the user typed in. */
  fromIncome: boolean;
  incomeTotalPaise: number;
  /** Money set aside for goals each month by active income sources. */
  savingsPaise: number;
};

/**
 * The monthly budget the rest of the app measures against.
 *  - A budget the user set is used as is. Savings are separate: they chose that number themselves.
 *  - Otherwise it is planned from income minus the money being saved (only for goals that still exist
 *    and are not yet full).
 *  - Carry-forward is added on top when enabled and there is a budget.
 */
export function computeMonthlyBudget(input: {
  overallPaise: number | undefined;
  sources: BudgetSource[];
  /** Goal ids that are still being saved towards (exist and are not complete). */
  openGoalIds: Set<string>;
  carryEnabled: boolean;
  carryPaise: number;
}): MonthlyBudget {
  const active = input.sources.filter((s) => s.active);
  const incomeTotalPaise = active.reduce((sum, s) => sum + s.amount_paise, 0);
  const savingsPaise = active.reduce(
    (sum, s) =>
      s.savings_goal_id && input.openGoalIds.has(s.savings_goal_id)
        ? sum + Math.min(s.savings_paise, s.amount_paise)
        : sum,
    0,
  );

  const fromIncome = input.overallPaise === undefined;
  const basePaise = Math.max(0, fromIncome ? incomeTotalPaise - savingsPaise : input.overallPaise!);
  const carryPaise = input.carryEnabled && basePaise > 0 ? Math.max(0, input.carryPaise) : 0;

  return {
    basePaise,
    carryPaise,
    totalPaise: basePaise > 0 ? basePaise + carryPaise : 0,
    fromIncome,
    incomeTotalPaise,
    savingsPaise,
  };
}
