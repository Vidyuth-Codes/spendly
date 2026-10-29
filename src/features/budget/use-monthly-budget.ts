import { useMemo } from 'react';

import { goalProgress } from '@/features/savings/progress';
import { useGoals } from '@/features/savings/api';

import { useBudgets, useIncomeSources } from './api';
import { useCarryAmount, useCarryEnabled } from './carry';
import { computeMonthlyBudget, type MonthlyBudget } from './monthly-budget';

/** The one place the monthly budget is assembled, so Home and the Budget tab always agree. */
export function useMonthlyBudget(): { budget: MonthlyBudget; carryEnabled: boolean; loading: boolean } {
  const budgets = useBudgets();
  const sources = useIncomeSources();
  const goals = useGoals();
  const carryEnabled = useCarryEnabled();
  const carry = useCarryAmount();

  const budget = useMemo(() => {
    // A goal still counts as "being saved for" only while it exists and is not full.
    const openGoalIds = new Set(
      (goals.data ?? []).filter((g) => !goalProgress(g, 0).completed).map((g) => g.id),
    );
    return computeMonthlyBudget({
      overallPaise: budgets.data?.find((b) => b.category_id === null)?.amount_paise,
      sources: sources.data ?? [],
      openGoalIds,
      carryEnabled: Boolean(carryEnabled.data),
      carryPaise: carry.data ?? 0,
    });
  }, [budgets.data, sources.data, goals.data, carryEnabled.data, carry.data]);

  return {
    budget,
    carryEnabled: Boolean(carryEnabled.data),
    loading: budgets.isLoading || sources.isLoading || goals.isLoading,
  };
}
