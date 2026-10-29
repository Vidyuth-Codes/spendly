import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Button } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FloatingTabInset, Spacing, Type } from '@/constants/theme';
import { activeCategories, useCategories } from '@/features/categories/api';
import { useMyTags } from '@/features/tags/api';
import { useTransactions, type Transaction, type TxnFilters, type TxnType } from '@/features/transactions/api';
import { TransactionRow } from '@/features/transactions/transaction-row';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, monthRange } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

type Period = 'month' | 'last' | 'all';

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [type, setType] = useState<'all' | TxnType>('all');
  const [period, setPeriod] = useState<Period>('month');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const { data: myTags } = useMyTags();

  // Arriving from a tag in Insights: filter to that tag across all time.
  const params = useLocalSearchParams<{ tag?: string }>();
  useEffect(() => {
    if (params.tag) {
      setTag(params.tag);
      setPeriod('all');
    }
  }, [params.tag]);

  const filters = useMemo<TxnFilters>(() => {
    const range = period === 'month' ? monthRange(0) : period === 'last' ? monthRange(-1) : {};
    return {
      type: type === 'all' ? undefined : type,
      categoryId,
      tag,
      search: debouncedSearch,
      ...range,
    };
  }, [type, period, categoryId, tag, debouncedSearch]);

  const { data: cats } = useCategories();
  const catById = useMemo(() => new Map((cats ?? []).map((c) => [c.id, c])), [cats]);
  const filterCats = activeCategories(cats, type === 'all' ? undefined : type);

  const { data, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions(filters);

  const sections = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const t of data?.pages.flat() ?? []) {
      const list = byDay.get(t.occurred_on);
      if (list) list.push(t);
      else byDay.set(t.occurred_on, [t]);
    }
    return [...byDay].map(([date, rows]) => ({
      date,
      data: rows,
      spent: rows.reduce((sum, t) => (t.type === 'expense' ? sum + t.amount_paise : sum), 0),
    }));
  }, [data]);

  const onType = (next: 'all' | TxnType) => {
    setType(next);
    setCategoryId(undefined); // the selected category may not exist for the other type
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <ScreenHeader title="Transactions" />

          <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search merchant or note"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              returnKeyType="search"
            />
            {search ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <Segmented
            value={type}
            onChange={onType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'expense', label: 'Expenses' },
              { value: 'income', label: 'Income' },
            ]}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="This month" selected={period === 'month'} onPress={() => setPeriod('month')} />
            <Chip label="Last month" selected={period === 'last'} onPress={() => setPeriod('last')} />
            <Chip label="All time" selected={period === 'all'} onPress={() => setPeriod('all')} />
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All categories" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
            {filterCats.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
              />
            ))}
          </ScrollView>

          {(myTags?.length ?? 0) > 0 || tag ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All tags" selected={!tag} onPress={() => setTag(undefined)} />
              {(myTags ?? []).map((t) => (
                <Chip
                  key={t.tag}
                  label={`#${t.tag}`}
                  selected={tag === t.tag}
                  onPress={() => setTag(tag === t.tag ? undefined : t.tag)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.center} color={theme.primary} />
        ) : error ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">Could not load transactions.</ThemedText>
            <Button variant="ghost" title="Retry" onPress={() => refetch()} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(t) => t.id}
            stickySectionHeadersEnabled={false}
            keyboardShouldPersistTaps="handled"
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            onEndReachedThreshold={0.4}
            onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No transactions here yet. Tap + to add one.
              </ThemedText>
            }
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ margin: Spacing.three }} /> : null}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {dayLabel(section.date)}
                </ThemedText>
                {section.spent > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Spent {formatPaise(section.spent)}
                  </ThemedText>
                ) : null}
              </View>
            )}
            renderItem={({ item }) => (
              <TransactionRow
                txn={item}
                category={item.category_id ? catById.get(item.category_id) : undefined}
                onPress={() => router.push({ pathname: '/transaction', params: { id: item.id } })}
              />
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, borderWidth: 1, paddingHorizontal: Spacing.three },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, fontFamily: Type.body },
  chips: { gap: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  list: { paddingHorizontal: Spacing.four, paddingBottom: FloatingTabInset, paddingTop: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.three, paddingBottom: Spacing.two },
});
