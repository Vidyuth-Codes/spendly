import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart, DonutChart, LineChart } from '@/components/charts';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FloatingTabInset, Spacing, Type } from '@/constants/theme';
import { useSpendByCategory } from '@/features/budget/api';
import { useSpendByTag } from '@/features/tags/api';
import { useCategories } from '@/features/categories/api';
import { CategoryIcon } from '@/features/categories/category-icon';
import { useDailyTotals, useSpendOverview } from '@/features/insights/api';
import {
  cumulative,
  groupSlices,
  UNCATEGORIZED_COLOR,
  type Slice,
} from '@/features/insights/chart-utils';
import { compareToPrevious, computeAverages, summarizePeriod } from '@/features/insights/summary';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, fromISODate, periodLabel, periodRange, todayISO, type PeriodKind } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

export default function InsightsScreen() {
  const theme = useTheme();
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0); // 0 = current period, -1 = previous, ...
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  const today = todayISO();
  const range = useMemo(() => periodRange(kind, offset), [kind, offset]);
  const previous = useMemo(() => periodRange(kind, offset - 1), [kind, offset]);

  const current = useDailyTotals(range);
  const prior = useDailyTotals(previous);
  const spend = useSpendByCategory(range);
  const tagSpend = useSpendByTag(range);
  const router = useRouter();
  const overview = useSpendOverview();
  const { data: cats } = useCategories();

  const summary = useMemo(
    () => (current.data ? summarizePeriod(current.data, range, today) : null),
    [current.data, range, today],
  );
  const change = useMemo(
    () => (summary && prior.data ? compareToPrevious(summary, prior.data, previous) : null),
    [summary, prior.data, previous],
  );
  const averages = useMemo(
    () => (overview.data ? computeAverages(overview.data.total_expense_paise, overview.data.first_date, today) : null),
    [overview.data, today],
  );

  const catById = useMemo(() => new Map((cats ?? []).map((c) => [c.id, c])), [cats]);
  const topCategories = useMemo(() => {
    const rows = [...(spend.data ?? [])].sort((a, b) => b.total_paise - a.total_paise);
    const total = rows.reduce((sum, r) => sum + r.total_paise, 0);
    return rows.map((r) => ({ ...r, category: r.category_id ? catById.get(r.category_id) : undefined, share: total ? r.total_paise / total : 0 }));
  }, [spend.data, catById]);

  const donutSlices = useMemo<Slice[]>(
    () =>
      groupSlices(
        topCategories.map((r) => ({
          key: r.category_id ?? 'none',
          label: r.category?.name ?? 'Uncategorized',
          value: r.total_paise,
          color: r.category?.color ?? UNCATEGORIZED_COLOR,
        })),
      ),
    [topCategories],
  );

  const priorSummary = useMemo(
    () => (prior.data ? summarizePeriod(prior.data, previous, today) : null),
    [prior.data, previous, today],
  );
  const dailySpend = useMemo(() => summary?.days.map((d) => d.expense_paise) ?? [], [summary]);
  // Running total this period (only up to today) vs. the whole previous period.
  const trend = useMemo(() => {
    if (!summary) return null;
    const now = cumulative(dailySpend).slice(0, Math.max(summary.daysElapsed, 1));
    const before = priorSummary ? cumulative(priorSummary.days.map((d) => d.expense_paise)) : [];
    return { now, before, length: Math.max(summary.days.length, before.length) };
  }, [summary, dailySpend, priorSummary]);

  const todayIndex = summary ? summary.days.findIndex((d) => d.day === today) : -1;
  const dayAxisLabel = (i: number) => {
    const day = summary?.days[i]?.day;
    if (!day) return null;
    if (kind === 'week') return 'SMTWTFS'[fromISODate(day).getDay()];
    const n = fromISODate(day).getDate();
    return n === 1 || n % 5 === 0 ? String(n) : null;
  };
  const trendAxisLabel = (i: number) => {
    const n = i + 1;
    if (kind === 'week') return `${'MTWTFSS'[i]}`;
    return n === 1 || n % 5 === 0 ? String(n) : null;
  };
  const selectedDay = selectedBar !== null ? summary?.days[selectedBar] : undefined;

  const error = current.error ?? overview.error ?? spend.error;
  const loading = current.isLoading;
  const unit = kind === 'week' ? 'week' : 'month';
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  const switchKind = (next: PeriodKind) => {
    setKind(next);
    setOffset(0);
    setSelectedBar(null);
  };
  const moveTo = (next: number) => {
    setOffset(next);
    setSelectedBar(null);
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Insights" />

          <Segmented
            value={kind}
            onChange={switchKind}
            options={[
              { value: 'week', label: 'Weekly' },
              { value: 'month', label: 'Monthly' },
            ]}
          />

          <View style={styles.nav}>
            <Pressable accessibilityLabel={`Previous ${unit}`} hitSlop={12} onPress={() => moveTo(offset - 1)}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.navLabel}>
              <ThemedText type="smallBold" style={styles.centerText}>
                {periodLabel(kind, range)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {offset === 0 ? `This ${unit}` : ' '}
              </ThemedText>
            </View>
            <Pressable
              accessibilityLabel={`Next ${unit}`}
              disabled={offset >= 0}
              hitSlop={12}
              onPress={() => moveTo(offset + 1)}>
              <Ionicons name="chevron-forward" size={24} color={offset >= 0 ? theme.border : theme.text} />
            </Pressable>
          </View>

          {error ? (
            <View style={card}>
              <ThemedText type="smallBold">Couldn&apos;t load insights</ThemedText>
              <ThemedText themeColor="textSecondary">{error.message}</ThemedText>
            </View>
          ) : loading || !summary ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.five }} />
          ) : (
            <>
              <View style={card}>
                <ThemedText type="small" themeColor="textSecondary">
                  Spent
                </ThemedText>
                <ThemedText style={styles.big}>{formatPaise(summary.expensePaise)}</ThemedText>
                {change ? (
                  <View style={styles.changeRow}>
                    <Ionicons
                      name={change.percent > 0 ? 'arrow-up' : change.percent < 0 ? 'arrow-down' : 'remove'}
                      size={16}
                      color={change.percent > 0 ? theme.danger : change.percent < 0 ? theme.primary : theme.textSecondary}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      {change.percent === 0 ? 'Same as' : `${Math.abs(change.percent)}% ${change.percent > 0 ? 'more' : 'less'} than`} last{' '}
                      {unit}
                      {offset === 0 ? ' (same days)' : ''}
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.statsRow}>
                  <Stat label="Income" value={formatPaise(summary.incomePaise)} color={theme.primary} />
                  <Stat
                    label="Net"
                    value={`${summary.netPaise < 0 ? '-' : ''}${formatPaise(Math.abs(summary.netPaise))}`}
                    color={summary.netPaise < 0 ? theme.danger : undefined}
                  />
                  <Stat label="Avg / day" value={formatPaise(summary.avgPerDayPaise)} />
                </View>
              </View>

              <View style={card}>
                <ThemedText type="smallBold">Spending by category</ThemedText>
                {topCategories.length === 0 ? (
                  <ThemedText themeColor="textSecondary">No spending this {unit}.</ThemedText>
                ) : (
                  <DonutChart
                    slices={donutSlices}
                    centerLabel="Total"
                    centerValue={formatPaise(summary.expensePaise)}
                  />
                )}
                {topCategories.length > 0 &&
                  topCategories.map((row) => (
                    <View key={row.category_id ?? 'none'} style={styles.catBlock}>
                      <View style={styles.catRow}>
                        {row.category ? (
                          <CategoryIcon icon={row.category.icon} color={row.category.color} size={32} />
                        ) : (
                          <View style={[styles.unknown, { backgroundColor: theme.backgroundSelected }]}>
                            <Ionicons name="help-outline" size={18} color={theme.textSecondary} />
                          </View>
                        )}
                        <ThemedText style={styles.flex}>{row.category?.name ?? 'Uncategorized'}</ThemedText>
                        <ThemedText type="smallBold">{formatPaise(row.total_paise)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.pct}>
                          {Math.round(row.share * 100)}%
                        </ThemedText>
                      </View>
                      <ProgressBar ratio={row.share} />
                    </View>
                  ))}
              </View>

              <View style={card}>
                <ThemedText type="smallBold">Daily spending</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {selectedDay
                    ? `${dayLabel(selectedDay.day)} · ${formatPaise(selectedDay.expense_paise)}`
                    : 'Tap a bar for that day. Dashed line is your daily average.'}
                </ThemedText>
                <BarChart
                  data={summary.days.map((d) => ({ key: d.day, value: d.expense_paise }))}
                  labelFor={dayAxisLabel}
                  averagePaise={summary.avgPerDayPaise}
                  selectedIndex={selectedBar}
                  onSelect={setSelectedBar}
                  highlightIndex={todayIndex >= 0 ? todayIndex : undefined}
                />
              </View>

              {trend ? (
                <View style={card}>
                  <ThemedText type="smallBold">Spending pace</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Running total this {unit} against last {unit}.
                  </ThemedText>
                  <LineChart
                    length={trend.length}
                    labelFor={trendAxisLabel}
                    series={[
                      { key: 'before', values: trend.before, color: theme.textSecondary, dashed: true },
                      { key: 'now', values: trend.now, color: theme.primary, endDot: true },
                    ]}
                  />
                  <View style={styles.legend}>
                    <LegendItem color={theme.primary} label={`This ${unit}`} />
                    <LegendItem color={theme.textSecondary} label={`Last ${unit}`} dashed />
                  </View>
                </View>
              ) : null}

              {(tagSpend.data?.length ?? 0) > 0 ? (
                <View style={card}>
                  <ThemedText type="smallBold">Spending by tag</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    A transaction with two tags counts under both. Tap a tag to see its transactions.
                  </ThemedText>
                  {tagSpend.data!.slice(0, 8).map((row) => (
                    <Pressable
                      key={row.tag}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/transactions', params: { tag: row.tag } })}
                      style={styles.catRow}>
                      <ThemedText style={[styles.flex, { color: theme.primary }]}>#{row.tag}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {row.txn_count} {row.txn_count === 1 ? 'payment' : 'payments'}
                      </ThemedText>
                      <ThemedText type="smallBold">{formatPaise(row.total_paise)}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={card}>
                <ThemedText type="smallBold">Average spending, all time</ThemedText>
                {averages ? (
                  <>
                    <View style={styles.statsRow}>
                      <Stat label="Per day" value={formatPaise(averages.perDayPaise)} />
                      <Stat label="Per week" value={formatPaise(averages.perWeekPaise)} />
                      <Stat label="Per month" value={formatPaise(averages.perMonthPaise)} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Based on {averages.daysTracked} {averages.daysTracked === 1 ? 'day' : 'days'} since your first transaction.
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText themeColor="textSecondary">Add a transaction to see your averages.</ThemedText>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, { borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: FloatingTabInset },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navLabel: { flex: 1, alignItems: 'stretch' },
  centerText: { textAlign: 'center' },
  legend: { flexDirection: 'row', gap: Spacing.four },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  legendLine: { width: 22, borderTopWidth: 2.5 },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  big: { fontFamily: Type.displayHeavy, fontSize: 38, lineHeight: 46, letterSpacing: -1 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2 },
  catBlock: { gap: Spacing.two },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  unknown: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pct: { width: 40, textAlign: 'right' },
});
