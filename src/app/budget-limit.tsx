import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBudgets, useSetBudget } from '@/features/budget/api';
import { useCategories } from '@/features/categories/api';
import { formatPaise, paiseToInput, parseRupees, sanitizeAmountInput } from '@/lib/money';

/** Sets the overall monthly budget (no categoryId) or a single category's monthly limit. */
export default function BudgetLimitScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { data: budgets, isLoading } = useBudgets();
  const { data: cats } = useCategories();

  const category = categoryId ? cats?.find((c) => c.id === categoryId) : undefined;
  const title = categoryId ? `${category?.name ?? 'Category'} limit` : 'Monthly budget';
  const current = budgets?.find((b) => (b.category_id ?? undefined) === categoryId);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      {isLoading ? (
        <ActivityIndicator style={styles.center} />
      ) : (
        <LimitForm categoryId={categoryId ?? null} currentPaise={current?.amount_paise} isCategory={Boolean(categoryId)} />
      )}
    </SafeAreaView>
  );
}

function LimitForm({
  categoryId,
  currentPaise,
  isCategory,
}: {
  categoryId: string | null;
  currentPaise: number | undefined;
  isCategory: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(currentPaise ? paiseToInput(currentPaise) : '');
  const [error, setError] = useState<string | null>(null);
  const setBudget = useSetBudget();

  const submit = (amountPaise: number | null) =>
    setBudget.mutate(
      { categoryId, amountPaise },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
    );

  const onSave = () => {
    const paise = parseRupees(amount);
    if (!paise) return setError('Enter an amount greater than 0');
    setError(null);
    submit(paise);
  };

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled">
      <ThemedText themeColor="textSecondary">
        {isCategory
          ? 'The most you want to spend on this category each month. You will see progress against it on the Budget tab.'
          : 'The total you plan to spend each month. Home uses it to show how much is safe to spend today. Leave it unset to use your monthly income total instead.'}
      </ThemedText>

      {currentPaise ? (
        <ThemedText type="smallBold">Current: {formatPaise(currentPaise)}</ThemedText>
      ) : null}

      <Field
        label="Monthly amount (₹)"
        value={amount}
        onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
        keyboardType="decimal-pad"
        placeholder="5000"
        autoFocus
        error={error ?? undefined}
      />

      <Button title="Save" onPress={onSave} loading={setBudget.isPending} />
      {currentPaise ? (
        <Button variant="ghost" title={isCategory ? 'Remove limit' : 'Clear budget'} onPress={() => submit(null)} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
});
