import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/features/categories/api';
import { CategoryIcon } from '@/features/categories/category-icon';
import { useTheme } from '@/hooks/use-theme';
import { formatPaise } from '@/lib/money';

import { PAYMENT_METHODS, type Transaction } from './api';

const methodLabel = (m: Transaction['payment_method']) =>
  PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;

export function TransactionRow({
  txn,
  category,
  onPress,
}: {
  txn: Transaction;
  category: Category | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isIncome = txn.type === 'income';
  const title = txn.merchant || category?.name || (isIncome ? 'Income' : 'Expense');
  const subtitle = [category?.name ?? 'Uncategorized', methodLabel(txn.payment_method)].join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      {category ? (
        <CategoryIcon icon={category.icon} color={category.color} />
      ) : (
        <View style={[styles.unknown, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="help-outline" size={20} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <ThemedText numberOfLines={1} style={styles.title}>
            {title}
          </ThemedText>
          {txn.recurring_expense_id || txn.income_source_id ? (
            <Ionicons name="repeat" size={15} color={theme.textSecondary} accessibilityLabel="Recurring" />
          ) : null}
          {txn.receipt_path ? (
            <Ionicons name="receipt-outline" size={15} color={theme.textSecondary} accessibilityLabel="Has a receipt" />
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
        {txn.tags.length > 0 ? (
          <ThemedText type="small" numberOfLines={1} style={{ color: theme.primary }}>
            {txn.tags.map((t) => `#${t}`).join(' ')}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="smallBold" style={isIncome ? { color: theme.primary } : undefined}>
        {isIncome ? '+' : '-'}
        {formatPaise(txn.amount_paise)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 18, borderWidth: 1 },
  unknown: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1 },
});
