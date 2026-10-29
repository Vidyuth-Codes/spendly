import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Button, ErrorText, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { activeCategories, useCategories } from '@/features/categories/api';
import {
  useDeleteRecurringExpense,
  useRecurringExpenses,
  useSaveRecurringExpense,
  type RecurringExpense,
} from '@/features/recurring/api';
import { PAYMENT_METHODS, type PaymentMethod } from '@/features/transactions/api';
import { useTheme } from '@/hooks/use-theme';
import { paiseToInput, parseRupees, sanitizeAmountInput } from '@/lib/money';

export default function RecurringExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useRecurringExpenses();
  const existing = id ? data?.find((r) => r.id === id) : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Edit recurring expense' : 'New recurring expense' }} />
      {id && isLoading ? <ActivityIndicator style={styles.center} /> : <RecurringForm initial={existing} />}
    </SafeAreaView>
  );
}

function RecurringForm({ initial }: { initial?: RecurringExpense }) {
  const router = useRouter();
  const theme = useTheme();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? paiseToInput(initial.amount_paise) : '');
  const [day, setDay] = useState(String(initial?.day_of_month ?? 1));
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [method, setMethod] = useState<PaymentMethod>(initial?.payment_method ?? 'upi');
  const [active, setActive] = useState(initial?.active ?? true);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; day?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: cats } = useCategories();
  const save = useSaveRecurringExpense();
  const remove = useDeleteRecurringExpense();
  const choices = activeCategories(cats, 'expense');

  const onSave = () => {
    const paise = parseRupees(amount);
    const dayNum = Number(day);
    const next = {
      name: name.trim() ? undefined : 'Enter a name',
      amount: paise ? undefined : 'Enter an amount greater than 0',
      day: Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31 ? undefined : 'Enter a day from 1 to 31',
    };
    setErrors(next);
    if (next.name || next.amount || next.day || !paise) return;
    setFormError(null);

    save.mutate(
      {
        id: initial?.id,
        name: name.trim(),
        amount_paise: paise,
        category_id: categoryId,
        payment_method: method,
        day_of_month: dayNum,
        active,
      },
      { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) },
    );
  };

  const onDelete = () =>
    Alert.alert('Delete recurring expense?', 'Transactions it already added are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(initial!.id, { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) }),
      },
    ]);

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <ThemedText themeColor="textSecondary">
        Bills that repeat every month, like rent or a subscription. They&apos;re added to your transactions
        automatically on the chosen day.
      </ThemedText>

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Netflix" maxLength={60} error={errors.name} />
      <Field
        label="Amount per month (₹)"
        value={amount}
        onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
        keyboardType="decimal-pad"
        placeholder="649"
        error={errors.amount}
      />
      <View>
        <Field
          label="Day of month"
          value={day}
          onChangeText={(t) => setDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="1"
          error={errors.day}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          In shorter months it&apos;s added on the last day (31 becomes 28 in February).
        </ThemedText>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold">Category</ThemedText>
        <View style={styles.wrap}>
          {choices.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              color={c.color}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold">Paid by</ThemedText>
        <View style={styles.wrap}>
          {PAYMENT_METHODS.map((m) => (
            <Chip key={m.value} label={m.label} selected={method === m.value} onPress={() => setMethod(m.value)} />
          ))}
        </View>
      </View>

      <View style={[styles.switchRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.flex}>
          <ThemedText>Active</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Turn off to pause without deleting
          </ThemedText>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: theme.primary }} />
      </View>

      {formError ? <ErrorText>{formError}</ErrorText> : null}

      <Button title={isEdit ? 'Save changes' : 'Add recurring expense'} onPress={onSave} loading={save.isPending} />
      {isEdit ? <Button variant="ghost" title="Delete" onPress={onDelete} loading={remove.isPending} /> : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  hint: { marginTop: Spacing.one },
  group: { gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14, borderWidth: 1 },
});
