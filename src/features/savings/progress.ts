export type Contribution = {
  id: string;
  amount_paise: number;
  contributed_on: string; // YYYY-MM-DD
  income_source_id: string | null;
  created_at: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  target_paise: number;
  created_at: string;
  contributions: Contribution[];
};

export type GoalProgress = {
  savedPaise: number;
  targetPaise: number;
  remainingPaise: number;
  /** 0..1, capped, for progress bars. */
  ratio: number;
  /** Whole percent, 0..100. Floors, so 99.9% never reads as "100%". */
  percent: number;
  completed: boolean;
  /** What is set aside for this goal each month from income sources. */
  monthlyPaise: number;
  /** Payments still needed at the monthly rate; null when nothing is being saved automatically. */
  monthsLeft: number | null;
};

export function goalProgress(goal: SavingsGoal, monthlyPaise: number): GoalProgress {
  const savedPaise = goal.contributions.reduce((sum, c) => sum + c.amount_paise, 0);
  const remainingPaise = Math.max(0, goal.target_paise - savedPaise);
  const completed = savedPaise >= goal.target_paise;
  const ratio = goal.target_paise > 0 ? Math.min(1, savedPaise / goal.target_paise) : 0;

  return {
    savedPaise,
    targetPaise: goal.target_paise,
    remainingPaise,
    ratio,
    percent: completed ? 100 : Math.floor(ratio * 100),
    completed,
    monthlyPaise,
    monthsLeft: completed ? 0 : monthlyPaise > 0 ? Math.ceil(remainingPaise / monthlyPaise) : null,
  };
}

type SourceLike = { active: boolean; savings_paise: number; savings_goal_id: string | null };

/** Sum of the monthly savings that active income sources put towards a goal. */
export function monthlyForGoal(goalId: string, sources: SourceLike[]): number {
  return sources
    .filter((s) => s.active && s.savings_goal_id === goalId)
    .reduce((sum, s) => sum + s.savings_paise, 0);
}

/** "Goal reached", "About 5 more months", or null when no automatic saving is set up. */
export function goalEtaLabel(p: GoalProgress): string | null {
  if (p.completed) return 'Goal reached';
  if (p.monthsLeft === null) return null;
  return p.monthsLeft === 1 ? 'About 1 more month' : `About ${p.monthsLeft} more months`;
}
