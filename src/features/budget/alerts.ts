export type AlertLevel = 80 | 100;

export type BudgetAlert = {
  /** Stable id: "overall" or "cat:<category id>". */
  key: string;
  kind: 'overall' | 'category';
  name: string;
  level: AlertLevel;
  spentPaise: number;
  limitPaise: number;
};

export type AlertInput = { key: string; kind: 'overall' | 'category'; name: string; limitPaise: number; spentPaise: number };

/** 100 once the limit is reached, 80 from 80% up to the limit, null below that. */
export function alertLevel(spentPaise: number, limitPaise: number): AlertLevel | null {
  if (limitPaise <= 0) return null;
  if (spentPaise >= limitPaise) return 100;
  return spentPaise * 5 >= limitPaise * 4 ? 80 : null; // integer maths for "spent / limit >= 0.8"
}

/** Everything currently at or beyond 80% of its limit, with the highest-level items first. */
export function computeAlerts(items: AlertInput[]): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  for (const i of items) {
    const level = alertLevel(i.spentPaise, i.limitPaise);
    if (level) alerts.push({ ...i, level });
  }
  return alerts.sort((a, b) => b.level - a.level || b.spentPaise / b.limitPaise - a.spentPaise / a.limitPaise);
}

/** The wording used for both the in-app card and the notification. */
export function alertText(alert: BudgetAlert, money: (paise: number) => string): { title: string; body: string } {
  const label = alert.kind === 'overall' ? 'Monthly budget' : `${alert.name} budget`;
  const used = `${money(alert.spentPaise)} of ${money(alert.limitPaise)} used this month.`;
  if (alert.level === 100) {
    const over = alert.spentPaise - alert.limitPaise;
    return {
      title: `${label} reached`,
      body: over > 0 ? `${used} You are ${money(over)} over.` : `${used} You have nothing left.`,
    };
  }
  return { title: `${label} at 80%`, body: `${used} ${money(alert.limitPaise - alert.spentPaise)} left.` };
}

/** Storage key for "already told the user about this alert this month". */
export const sentKey = (month: string, alert: Pick<BudgetAlert, 'key' | 'level'>) => `${month}|${alert.key}|${alert.level}`;

/**
 * Alerts the user has not been notified about yet this month. Having been told about 100% also covers
 * 80% (so a dip below the limit and back never repeats the milder message), but reaching 100% after
 * only being told about 80% is new information.
 */
export function unsentAlerts(alerts: BudgetAlert[], sent: Set<string>, month: string): BudgetAlert[] {
  return alerts.filter((a) => {
    if (sent.has(sentKey(month, a))) return false;
    if (a.level === 80 && sent.has(sentKey(month, { key: a.key, level: 100 }))) return false;
    return true;
  });
}
