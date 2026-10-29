import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText } from '@/components/form';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FloatingTabInset, Spacing } from '@/constants/theme';
import { useBudgets, useIncomeSources, useSpendByCategory } from '@/features/budget/api';
import { limitStatus } from '@/features/budget/safe-to-spend';
import { useMonthlyBudget } from '@/features/budget/use-monthly-budget';
import { activeCategories, useCategories } from '@/features/categories/api';
import { CategoryIcon } from '@/features/categories/category-icon';
import { useLoans } from '@/features/loans/api';
import { summarizeLoans } from '@/features/loans/balances';
import { useRecurringExpenses } from '@/features/recurring/api';
import { useGoals } from '@/features/savings/api';
import { goalEtaLabel, goalProgress, monthlyForGoal } from '@/features/savings/progress';
import { useTheme } from '@/hooks/use-theme';
import { formatPaise } from '@/lib/money';

const ordinal = (n: number) => {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
};

export default function BudgetScreen() {
  const router = useRouter();
  const theme = useTheme();

  const { data: sources } = useIncomeSources();
  const { data: budgets } = useBudgets();
  const { data: cats } = useCategories();
  const { data: spend, error: spendError } = useSpendByCategory();
  const { data: goals } = useGoals();
  const { data: recurring } = useRecurringExpenses();
  const { data: loans } = useLoans();
  const loanSummary = useMemo(() => summarizeLoans(loans ?? []), [loans]);
  const recurringTotal = (recurring ?? []).filter((r) => r.active).reduce((sum, r) => sum + r.amount_paise, 0);
  const { budget: monthly } = useMonthlyBudget();

  const goalName = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g.name])), [goals]);
  const overall = budgets?.find((b) => b.category_id === null);
  const limitByCat = useMemo(
    () => new Map((budgets ?? []).filter((b) => b.category_id).map((b) => [b.category_id!, b.amount_paise])),
    [budgets],
  );
  const spentByCat = useMemo(
    () => new Map((spend ?? []).map((s) => [s.category_id, s.total_paise])),
    [spend],
  );

  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Budget" />

          {/* Monthly income */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              MONTHLY INCOME
            </ThemedText>
            {(sources ?? []).map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/income-source', params: { id: s.id } })}
                style={[card, styles.row, !s.active && { opacity: 0.5 }]}>
                <View style={styles.flex}>
                  <ThemedText>{s.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {ordinal(s.day_of_month)} of every month{s.active ? '' : ' · paused'}
                  </ThemedText>
                  {s.savings_goal_id && s.savings_paise > 0 ? (
                    <ThemedText type="small" style={{ color: theme.primary }}>
                      Saves {formatPaise(s.savings_paise)} for {goalName.get(s.savings_goal_id) ?? 'a goal'}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  +{formatPaise(s.amount_paise)}
                </ThemedText>
              </Pressable>
            ))}
            {!sources?.length ? (
              <ThemedText themeColor="textSecondary">
                Add money that arrives every month, like your allowance from Dad.
              </ThemedText>
            ) : null}
            <Button variant="ghost" title="Add income source" onPress={() => router.push('/income-source')} />
          </View>

          {/* Recurring expenses */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              RECURRING EXPENSES
            </ThemedText>
            {(recurring ?? []).map((r) => {
              const category = r.category_id ? cats?.find((c) => c.id === r.category_id) : undefined;
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/recurring-expense', params: { id: r.id } })}
                  style={[card, styles.row, !r.active && { opacity: 0.5 }]}>
                  <View style={styles.flex}>
                    <ThemedText>{r.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {ordinal(r.day_of_month)} of every month{category ? ` · ${category.name}` : ''}
                      {r.active ? '' : ' · paused'}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">-{formatPaise(r.amount_paise)}</ThemedText>
                </Pressable>
              );
            })}
            {recurringTotal > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {formatPaise(recurringTotal)} a month is already committed to these.
              </ThemedText>
            ) : !recurring?.length ? (
              <ThemedText themeColor="textSecondary">
                Rent, subscriptions, recharges: add them once and they&apos;re logged every month.
              </ThemedText>
            ) : null}
            <Button variant="ghost" title="Add recurring expense" onPress={() => router.push('/recurring-expense')} />
          </View>

          {/* Lent and borrowed */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              LENT &amp; BORROWED
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={() => router.push('/loans')} style={[card, styles.row]}>
              <View style={styles.flex}>
                {loanSummary.openCount === 0 ? (
                  <ThemedText>Track money between friends</ThemedText>
                ) : (
                  <>
                    <ThemedText>
                      {loanSummary.owedToYouPaise > 0 ? `${formatPaise(loanSummary.owedToYouPaise)} owed to you` : 'Nobody owes you'}
                    </ThemedText>
                    {loanSummary.youOwePaise > 0 ? (
                      <ThemedText type="small" style={{ color: theme.warning }}>
                        You owe {formatPaise(loanSummary.youOwePaise)}
                      </ThemedText>
                    ) : null}
                  </>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  {loanSummary.openCount === 0 ? 'Like "Rahul owes me ₹300"' : `${loanSummary.openCount} open`}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Savings goals */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              SAVINGS GOALS
            </ThemedText>
            {(goals ?? []).map((g) => {
              const p = goalProgress(g, monthlyForGoal(g.id, sources ?? []));
              const eta = goalEtaLabel(p);
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/goal', params: { id: g.id } })}
                  style={[card, styles.catRow]}>
                  <View style={styles.row}>
                    <View style={[styles.goalIcon, { backgroundColor: theme.backgroundSelected }]}>
                      <Ionicons name={p.completed ? 'checkmark-circle' : 'flag-outline'} size={20} color={theme.primary} />
                    </View>
                    <ThemedText style={styles.flex} numberOfLines={1}>
                      {g.name}
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      {p.percent}%
                    </ThemedText>
                  </View>
                  <ProgressBar ratio={p.ratio} />
                  <View style={styles.goalMeta}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatPaise(p.savedPaise)} of {formatPaise(p.targetPaise)}
                    </ThemedText>
                    {eta ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {eta}
                      </ThemedText>
                    ) : null}
                  </View>
                  {p.monthlyPaise > 0 && !p.completed ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Saving {formatPaise(p.monthlyPaise)} a month
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
            {!goals?.length ? (
              <ThemedText themeColor="textSecondary">
                Saving for something, like a new phone? Add a goal, then choose it on an income source to set money
                aside automatically each month.
              </ThemedText>
            ) : null}
            <Button variant="ghost" title="Add savings goal" onPress={() => router.push('/goal')} />
          </View>

          {/* Overall budget */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              MONTHLY BUDGET
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/budget-limit')}
              style={[card, styles.row]}>
              <View style={styles.flex}>
                <ThemedText>{monthly.basePaise ? formatPaise(monthly.basePaise) : 'Not set'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {overall
                    ? 'Your total spending target per month'
                    : monthly.basePaise
                      ? monthly.savingsPaise > 0
                        ? `${formatPaise(monthly.incomeTotalPaise)} income minus ${formatPaise(monthly.savingsPaise)} you save`
                        : 'Planned from your monthly income'
                      : 'Set a target to see what is safe to spend'}
                </ThemedText>
                {monthly.carryPaise > 0 ? (
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    Plus {formatPaise(monthly.carryPaise)} carried over from last month
                  </ThemedText>
                ) : null}
                {overall && monthly.savingsPaise > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatPaise(monthly.savingsPaise)} a month goes to savings, separate from this budget.
                  </ThemedText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Category limits */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              CATEGORY LIMITS · THIS MONTH
            </ThemedText>
            {spendError ? <ErrorText>{`Couldn't load spending: ${spendError.message}`}</ErrorText> : null}
            {activeCategories(cats, 'expense').map((c) => {
              const limit = limitByCat.get(c.id);
              const spent = spentByCat.get(c.id) ?? 0;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/budget-limit', params: { categoryId: c.id } })}
                  style={[card, styles.catRow]}>
                  <View style={styles.row}>
                    <CategoryIcon icon={c.icon} color={c.color} size={36} />
                    <ThemedText style={styles.flex}>{c.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {limit ? `${formatPaise(spent)} of ${formatPaise(limit)}` : spent ? `${formatPaise(spent)} · no limit` : 'No limit'}
                    </ThemedText>
                  </View>
                  {limit ? <ProgressBar ratio={spent / limit} status={limitStatus(spent, limit)} /> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: FloatingTabInset },
  section: { gap: Spacing.two },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  catRow: { gap: Spacing.two },
  goalIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  goalMeta: { flexDirection: 'row', justifyContent: 'space-between' },
});
