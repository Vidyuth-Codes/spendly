import { useMemo } from 'react';

import { useBudgets, useSpendByCategory } from '@/features/budget/api';
import { useCategories } from '@/features/categories/api';

import { computeAlerts, type AlertInput, type BudgetAlert } from './alerts';
import { useMonthlyBudget } from './use-monthly-budget';

/** What is currently at or beyond 80% of its limit this month. `ready` is false until the data is in. */
export function useBudgetAlerts(): { alerts: BudgetAlert[]; ready: boolean } {
  const { budget, loading } = useMonthlyBudget();
  const budgets = useBudgets();
  const cats = useCategories();
  const spend = useSpendByCategory();

  const ready = !loading && !budgets.isLoading && !cats.isLoading && spend.data !== undefined;

  const alerts = useMemo(() => {
    if (!ready) return [];
    const spentBy = new Map(spend.data!.map((s) => [s.category_id, s.total_paise]));
    const items: AlertInput[] = [];

    if (budget.totalPaise > 0) {
      const spent = spend.data!.reduce((sum, s) => sum + s.total_paise, 0);
      items.push({ key: 'overall', kind: 'overall', name: 'Monthly budget', limitPaise: budget.totalPaise, spentPaise: spent });
    }
    for (const b of budgets.data ?? []) {
      if (!b.category_id) continue;
      const category = cats.data?.find((c) => c.id === b.category_id);
      if (!category || category.archived_at) continue;
      items.push({
        key: `cat:${b.category_id}`,
        kind: 'category',
        name: category.name,
        limitPaise: b.amount_paise,
        spentPaise: spentBy.get(b.category_id) ?? 0,
      });
    }
    return computeAlerts(items);
  }, [ready, spend.data, budget.totalPaise, budgets.data, cats.data]);

  return { alerts, ready };
}
