import { useEffect, useRef } from 'react';

import { alertText, sentKey, unsentAlerts } from '@/features/budget/alerts';
import {
  loadSent,
  permissionForAlerts,
  saveSent,
  sendNotification,
  useAlertsEnabled,
} from '@/features/budget/alert-notifications';
import { useBudgetAlerts } from '@/features/budget/use-budget-alerts';
import { monthRange } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

/**
 * Renders nothing. Whenever spending changes, it checks which budgets have just crossed 80% or 100%
 * and sends one notification for each, once per month. Adding a transaction, importing a
 * statement, or a recurring expense landing all go through the same check.
 */
export function BudgetAlertWatcher() {
  const { alerts, ready } = useBudgetAlerts();
  const [enabled] = useAlertsEnabled();
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || enabled !== true || alerts.length === 0 || busy.current) return;
    busy.current = true;

    (async () => {
      const month = monthRange(0).from.slice(0, 7); // "2026-09"
      const sent = await loadSent(month);
      const fresh = unsentAlerts(alerts, sent, month);
      if (fresh.length === 0) return;

      // Remember first, so a slow or failed send can never cause the same alert to repeat.
      for (const a of fresh) sent.add(sentKey(month, a));
      await saveSent(month, sent);

      if (!(await permissionForAlerts())) return;
      for (const a of fresh) {
        const { title, body } = alertText(a, formatPaise);
        await sendNotification(title, body);
      }
    })()
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }, [alerts, ready, enabled]);

  return null;
}
