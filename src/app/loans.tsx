import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { ProgressBar } from '@/components/progress-bar';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Type } from '@/constants/theme';
import { loanBalance, sortLoans, summarizeLoans } from '@/features/loans/balances';
import { useLoans } from '@/features/loans/api';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

type Filter = 'open' | 'settled';

export default function LoansScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useLoans();
  const [filter, setFilter] = useState<Filter>('open');

  const summary = useMemo(() => summarizeLoans(data ?? []), [data]);
  const rows = useMemo(
    () => sortLoans(data ?? []).filter((l) => loanBalance(l).settled === (filter === 'settled')),
    [data, filter],
  );
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Lent & borrowed' }} />

      {isLoading ? (
        <ActivityIndicator style={styles.center} color={theme.primary} />
      ) : error ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">Could not load this.</ThemedText>
          <Button variant="ghost" title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(l) => l.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={card}>
                <View style={styles.summaryRow}>
                  <View style={styles.flex}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Owed to you
                    </ThemedText>
                    <ThemedText style={[styles.big, { color: theme.primary }]}>{formatPaise(summary.owedToYouPaise)}</ThemedText>
                  </View>
                  <View style={[styles.flex, styles.right]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      You owe
                    </ThemedText>
                    <ThemedText style={[styles.big, summary.youOwePaise > 0 ? { color: theme.warning } : undefined]}>
                      {formatPaise(summary.youOwePaise)}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Kept separate from your budget: lending money isn&apos;t spending.
                </ThemedText>
              </View>
              <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'open', label: `Open${summary.openCount ? ` (${summary.openCount})` : ''}` },
                  { value: 'settled', label: 'Settled' },
                ]}
              />
            </View>
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {filter === 'open'
                ? 'Nothing open. Track money you lent or borrowed, like "Rahul owes me ₹300".'
                : 'Nothing settled yet.'}
            </ThemedText>
          }
          renderItem={({ item }) => {
            const b = loanBalance(item);
            const lent = item.direction === 'lent';
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/loan', params: { id: item.id } })}
                style={({ pressed }) => [card, styles.item, pressed && { opacity: 0.7 }]}>
                <View style={styles.itemTop}>
                  <View style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name={lent ? 'arrow-up' : 'arrow-down'} size={18} color={lent ? theme.primary : theme.warning} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{item.person}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {lent ? 'You lent' : 'You borrowed'} {formatPaise(item.amount_paise)} · {dayLabel(item.occurred_on)}
                    </ThemedText>
                  </View>
                  <View style={styles.right}>
                    <ThemedText type="smallBold" style={{ color: b.settled ? theme.textSecondary : lent ? theme.primary : theme.warning }}>
                      {b.settled ? 'Settled' : formatPaise(b.remainingPaise)}
                    </ThemedText>
                    {b.settled ? null : (
                      <ThemedText type="small" themeColor="textSecondary">
                        {lent ? 'to get back' : 'to pay back'}
                      </ThemedText>
                    )}
                  </View>
                </View>
                {b.paidPaise > 0 && !b.settled ? <ProgressBar ratio={b.ratio} /> : null}
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Button title="Add lent or borrowed" onPress={() => router.push('/loan')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  list: { padding: Spacing.four },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  card: { borderRadius: 20, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  summaryRow: { flexDirection: 'row', gap: Spacing.three },
  big: { fontFamily: Type.displayHeavy, fontSize: 26, lineHeight: 34 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  item: { gap: Spacing.three },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: Spacing.four },
});
