import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { PickerModal } from '@/components/picker-modal';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/features/categories/api';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

import type { ImportRow } from './api';
import type { BadRow } from './normalize';

export type ReviewItem = ImportRow & {
  id: number;
  rowIndex: number;
  /** imported = this exact row was imported before; possible = a hand-entered transaction matches. */
  status: 'new' | 'imported' | 'possible';
  selected: boolean;
  /** Short merchant word used to apply a category to similar rows and remember it. */
  keyword: string | null;
};

type Filter = 'all' | 'import' | 'skip';

export function ReviewStep({
  initial,
  bad,
  categories,
  importing,
  onImport,
  onBack,
}: {
  initial: ReviewItem[];
  bad: BadRow[];
  categories: Category[];
  importing: boolean;
  onImport: (rows: ImportRow[], learn: Map<string, string>) => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [items, setItems] = useState(initial);
  const [learn, setLearn] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>('all');
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showBad, setShowBad] = useState(false);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = items.filter((i) => i.selected);
  const duplicates = items.filter((i) => i.status === 'imported').length;
  const possible = items.filter((i) => i.status === 'possible').length;
  const uncategorized = selected.filter((i) => !i.categoryId).length;
  const visible = items.filter((i) => (filter === 'all' ? true : filter === 'import' ? i.selected : !i.selected));
  const picking = pickingId === null ? undefined : items.find((i) => i.id === pickingId);

  const toggle = (id: number) => setItems((all) => all.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)));

  const chooseCategory = (categoryId: string | null) => {
    if (!picking) return;
    // Applies to every row from the same merchant, and is remembered for the next statement.
    const same = picking.keyword ? items.filter((i) => i.keyword === picking.keyword && i.type === picking.type) : [picking];
    const ids = new Set(same.map((i) => i.id));
    setItems((all) => all.map((i) => (ids.has(i.id) ? { ...i, categoryId } : i)));
    if (picking.keyword) {
      setLearn((prev) => {
        const next = new Map(prev);
        if (categoryId) next.set(picking.keyword!, categoryId);
        else next.delete(picking.keyword!);
        return next;
      });
    }
    setNote(same.length > 1 ? `Applied to ${same.length} similar transactions and remembered for next time.` : '');
    setPickingId(null);
  };

  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  const header = (
    <View style={styles.headerBlock}>
      <View style={card}>
        <ThemedText type="smallBold">{selected.length} of {items.length} will be imported</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {duplicates > 0 ? `${duplicates} already imported (skipped). ` : ''}
          {possible > 0 ? `${possible} look like transactions you added by hand (skipped, tick to include). ` : ''}
          {uncategorized > 0 ? `${uncategorized} have no category yet. Tap a category to set it.` : 'All have a category.'}
        </ThemedText>
        {note ? (
          <ThemedText type="small" style={{ color: theme.primary }}>
            {note}
          </ThemedText>
        ) : null}
        <View style={styles.bulk}>
          <Pressable accessibilityRole="button" onPress={() => setItems((all) => all.map((i) => ({ ...i, selected: i.status === 'new' })))}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Select new
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setItems((all) => all.map((i) => ({ ...i, selected: true })))}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Select all
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setItems((all) => all.map((i) => ({ ...i, selected: false })))}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Clear
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `All ${items.length}` },
          { value: 'import', label: `Importing ${selected.length}` },
          { value: 'skip', label: `Skipped ${items.length - selected.length}` },
        ]}
      />
    </View>
  );

  const footer = bad.length > 0 ? (
    <View style={[card, styles.badBlock]}>
      <Pressable accessibilityRole="button" onPress={() => setShowBad((v) => !v)} style={styles.badHeader}>
        <ThemedText type="smallBold" style={styles.flex}>
          {bad.length} rows couldn&apos;t be read
        </ThemedText>
        <Ionicons name={showBad ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pressable>
      {showBad
        ? bad.slice(0, 20).map((b) => (
            <ThemedText key={b.rowIndex} type="small" themeColor="textSecondary">
              Row {b.rowIndex + 1}: {b.reason}
            </ThemedText>
          ))
        : null}
      {showBad && bad.length > 20 ? (
        <ThemedText type="small" themeColor="textSecondary">
          …and {bad.length - 20} more. Usually totals, balances, or blank lines.
        </ThemedText>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing here.
          </ThemedText>
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        initialNumToRender={12}
        windowSize={9}
        renderItem={({ item }) => {
          const category = item.categoryId ? catById.get(item.categoryId) : undefined;
          return (
            <View style={[card, styles.row, !item.selected && { opacity: 0.55 }]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.selected }}
                accessibilityLabel={`Import ${item.description || 'transaction'}`}
                hitSlop={8}
                onPress={() => toggle(item.id)}>
                <Ionicons
                  name={item.selected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={item.selected ? theme.primary : theme.textSecondary}
                />
              </Pressable>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={2}>
                  {item.merchant ?? (item.description || 'No description')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {dayLabel(item.date)}
                  {item.status === 'imported' ? ' · Already imported' : ''}
                </ThemedText>
                {item.status === 'possible' ? (
                  <ThemedText type="small" style={{ color: theme.warning }}>
                    Looks like one you added by hand
                  </ThemedText>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPickingId(item.id)}
                  style={[styles.catPill, { borderColor: category ? category.color : theme.border }]}>
                  <View style={[styles.dot, { backgroundColor: category?.color ?? theme.textSecondary }]} />
                  <ThemedText type="small">{category?.name ?? 'Choose category'}</ThemedText>
                </Pressable>
              </View>
              <ThemedText type="smallBold" style={item.type === 'income' ? { color: theme.primary } : undefined}>
                {item.type === 'income' ? '+' : '-'}
                {formatPaise(item.amountPaise)}
              </ThemedText>
            </View>
          );
        }}
      />

      <SafeAreaView edges={['bottom']} style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <View style={styles.barButtons}>
          <View style={styles.backButton}>
            <Button variant="ghost" title="Back" onPress={onBack} />
          </View>
          <View style={styles.flex}>
            <Button
              title={selected.length ? `Import ${selected.length} transaction${selected.length === 1 ? '' : 's'}` : 'Nothing selected'}
              disabled={selected.length === 0}
              loading={importing}
              onPress={() =>
                onImport(
                  selected.map(({ key, date, type, amountPaise, description, merchant, categoryId, paymentMethod }) => ({
                    key, date, type, amountPaise, description, merchant, categoryId, paymentMethod,
                  })),
                  learn,
                )
              }
            />
          </View>
        </View>
      </SafeAreaView>

      <PickerModal
        visible={picking !== undefined}
        title={picking ? `Category for ${picking.merchant ?? 'this transaction'}` : ''}
        selected={picking?.categoryId ?? ''}
        options={[
          { value: '', label: 'No category' },
          ...categories.filter((c) => c.kind === picking?.type).map((c) => ({ value: c.id, label: c.name })),
        ]}
        onClose={() => setPickingId(null)}
        onSelect={(v) => chooseCategory(v || null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.four, paddingBottom: Spacing.four },
  headerBlock: { gap: Spacing.three, marginBottom: Spacing.three },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  bulk: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: Spacing.one,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  badBlock: { marginTop: Spacing.three },
  badHeader: { flexDirection: 'row', alignItems: 'center' },
  bar: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, borderTopWidth: 1 },
  barButtons: { flexDirection: 'row', gap: Spacing.two },
  backButton: { width: 96 },
});
