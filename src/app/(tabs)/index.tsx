import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniBars, RingGauge } from '@/components/charts';
import { Button } from '@/components/form';
import { useStatusColor } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FloatingTabInset, Spacing, Type } from '@/constants/theme';
import { useSpendByCategory } from '@/features/budget/api';
import { computeSafeToSpend } from '@/features/budget/safe-to-spend';
import { alertText } from '@/features/budget/alerts';
import { useBudgetAlerts } from '@/features/budget/use-budget-alerts';
import { useMonthlyBudget } from '@/features/budget/use-monthly-budget';
import { useCategories } from '@/features/categories/api';
import { useDailyTotals } from '@/features/insights/api';
import { summarizePeriod } from '@/features/insights/summary';
import { useTransactions } from '@/features/transactions/api';
import { TransactionRow } from '@/features/transactions/transaction-row';
import { useTheme } from '@/hooks/use-theme';
import { useDisplayName } from '@/lib/auth';
import { shortMonthLabel, todayISO, weekRange } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const today = todayISO();
  const name = useDisplayName();

  const { budget, loading: loadingBudget } = useMonthlyBudget();
  const { alerts } = useBudgetAlerts();
  const { data: spend, isLoading: loadingSpend, error: spendError, refetch: refetchSpend } = useSpendByCategory();
  const week = useMemo(() => weekRange(0), []);
  const { data: weekRows } = useDailyTotals(week);
  const { data: recent } = useTransactions({});
  const { data: cats } = useCategories();
  const loading = loadingBudget || loadingSpend;

  // Spending is measured against the budget after savings, plus anything carried over.
  const summary = useMemo(() => {
    if (!budget.totalPaise) return null;
    const spent = (spend ?? []).reduce((sum, s) => sum + s.total_paise, 0);
    return computeSafeToSpend(budget.totalPaise, spent);
  }, [budget.totalPaise, spend]);

  const weekSummary = useMemo(() => (weekRows ? summarizePeriod(weekRows, week, today) : null), [weekRows, week, today]);
  const catById = useMemo(() => new Map((cats ?? []).map((c) => [c.id, c])), [cats]);
  const latest = recent?.pages[0]?.slice(0, 3) ?? [];

  const statusColor = useStatusColor(summary?.status);
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title={`Hi, ${name}`}
            titleSize={20}
            accessory={
              <View style={[styles.pill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {shortMonthLabel()}
                </ThemedText>
              </View>
            }
          />

          <View style={[card, styles.hero]}>
            {loading ? (
              <ActivityIndicator color={theme.primary} style={{ height: 196 }} />
            ) : spendError ? (
              <View style={styles.heroMessage}>
                <ThemedText type="smallBold">Couldn&apos;t load your spending</ThemedText>
                <ThemedText themeColor="textSecondary">{spendError.message}</ThemedText>
                <Button variant="ghost" title="Retry" onPress={() => refetchSpend()} />
              </View>
            ) : !summary ? (
              <View style={styles.heroMessage}>
                <ThemedText type="smallBold">Set up your budget</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Add your monthly allowance or set a budget to see how much you can safely spend each day.
                </ThemedText>
                <Button title="Go to Budget" onPress={() => router.push('/budget')} />
              </View>
            ) : (
              <>
                <RingGauge
                  fraction={summary.status === 'over' ? 1 : 1 - summary.ratio}
                  color={statusColor}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.ringLabel}>
                    {summary.status === 'over' ? 'Over budget' : 'Safe today'}
                  </ThemedText>
                  <Text style={[styles.ringValue, { color: summary.status === 'over' ? theme.danger : theme.text }]}>
                    {formatPaise(summary.status === 'over' ? -summary.remainingPaise : summary.perDayPaise)}
                  </Text>
                  <ThemedText type="small" themeColor="textSecondary">
                    {summary.daysLeft} {summary.daysLeft === 1 ? 'day' : 'days'} left
                  </ThemedText>
                </RingGauge>
                <View style={styles.statsRow}>
                  <Stat label="Spent" value={formatPaise(summary.spentPaise)} />
                  <Stat
                    label={summary.remainingPaise < 0 ? 'Over' : 'Left'}
                    value={formatPaise(Math.abs(summary.remainingPaise))}
                    color={statusColor}
                    align="center"
                  />
                  <Stat label="Budget" value={formatPaise(summary.budgetPaise)} align="right" />
                </View>
                {budget.carryPaise > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    Includes {formatPaise(budget.carryPaise)} carried over from last month
                  </ThemedText>
                ) : null}
                {budget.fromIncome && budget.savingsPaise > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    {formatPaise(budget.savingsPaise)} a month is set aside for your savings goals
                  </ThemedText>
                ) : null}
              </>
            )}
          </View>

          {alerts.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/budget')} style={card}>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardTitle}>Budget alerts</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {alerts.length} {alerts.length === 1 ? 'item' : 'items'}
                </ThemedText>
              </View>
              {alerts.slice(0, 3).map((a) => {
                const color = a.level === 100 ? theme.danger : theme.warning;
                return (
                  <View key={a.key} style={styles.alertRow}>
                    <View style={[styles.alertDot, { backgroundColor: color }]} />
                    <View style={styles.alertText}>
                      <ThemedText type="smallBold">{alertText(a, formatPaise).title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {alertText(a, formatPaise).body}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </Pressable>
          ) : null}

          <View style={card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>This week</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {weekSummary ? `avg ${formatPaise(weekSummary.avgPerDayPaise)} / day` : ''}
              </ThemedText>
            </View>
            <MiniBars
              values={weekSummary?.days.map((d) => d.expense_paise) ?? new Array(7).fill(0)}
              labels={WEEK_LABELS}
              highlightIndex={weekSummary ? weekSummary.days.findIndex((d) => d.day === today) : undefined}
            />
          </View>

          <View style={styles.recentHeader}>
            <ThemedText style={styles.cardTitle}>Recent</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => router.push('/transactions')} hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                See all
              </ThemedText>
            </Pressable>
          </View>
          {latest.length === 0 ? (
            <ThemedText themeColor="textSecondary">No transactions yet. Tap + to add your first.</ThemedText>
          ) : (
            latest.map((t) => (
              <TransactionRow
                key={t.id}
                txn={t}
                category={t.category_id ? catById.get(t.category_id) : undefined}
                onPress={() => router.push({ pathname: '/transaction', params: { id: t.id } })}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({
  label,
  value,
  color,
  align = 'left',
}: {
  label: string;
  value: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <View style={{ alignItems, gap: 2 }}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={[styles.statValue, color ? { color } : undefined]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: FloatingTabInset },
  pill: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, justifyContent: 'center' },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  hero: { padding: Spacing.four, alignItems: 'stretch', gap: Spacing.four },
  heroMessage: { gap: Spacing.three },
  ringLabel: { textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 },
  ringValue: { fontFamily: Type.displayHeavy, fontSize: 42, lineHeight: 50, letterSpacing: -1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  note: { textAlign: 'center', marginTop: -Spacing.two },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  alertText: { flex: 1 },
  statValue: { fontFamily: Type.display, fontSize: 17, lineHeight: 24 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: Type.display, fontSize: 15 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: Spacing.two },
});
