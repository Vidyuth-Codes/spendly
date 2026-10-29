import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { applyRecurringIncome } from '@/features/budget/api';
import { applyCarryForward } from '@/features/budget/carry';
import { applyRecurringExpenses } from '@/features/recurring/api';

/**
 * Renders nothing. When the app opens, and whenever it returns to the foreground, it adds whatever
 * recurring money is due: income (allowance, salary, and the savings that come out of it) and
 * recurring expenses (rent, subscriptions). Then it works out this month's carry-forward, which
 * depends on the budget that income produces. Everything is idempotent on the server.
 */
export function RecurringIncomeSync() {
  const client = useQueryClient();

  useEffect(() => {
    const run = async () => {
      await applyRecurringIncome(client).catch(() => {}); // best effort; retried on next foreground
      await applyRecurringExpenses(client).catch(() => {});
      await applyCarryForward(client).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [client]);

  return null;
}
