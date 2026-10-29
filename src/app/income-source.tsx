import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Button, ErrorText, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  useDeleteIncomeSource,
  useIncomeSources,
  useSaveIncomeSource,
  type IncomeSource,
} from '@/features/budget/api';
import { useGoals } from '@/features/savings/api';
import { goalProgress } from '@/features/savings/progress';
import { useTheme } from '@/hooks/use-theme';
import { formatPaise, paiseToInput, parseRupees, sanitizeAmountInput } from '@/lib/money';

export default function IncomeSourceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useIncomeSources();
  const existing = id ? data?.find((s) => s.id === id) : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Edit income' : 'New income' }} />
      {id && isLoading ? <ActivityIndicator style={styles.center} /> : <IncomeForm initial={existing} />}
    </SafeAreaView>
  );
}

function IncomeForm({ initial }: { initial?: IncomeSource }) {
  const router = useRouter();
  const theme = useTheme();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? paiseToInput(initial.amount_paise) : '');
  const [day, setDay] = useState(String(initial?.day_of_month ?? 1));
  const [active, setActive] = useState(initial?.active ?? true);
  const [saveOn, setSaveOn] = useState(Boolean(initial?.savings_goal_id && initial.savings_paise > 0));
  const [saveAmount, setSaveAmount] = useState(
    initial?.savings_goal_id && initial.savings_paise > 0 ? paiseToInput(initial.savings_paise) : '',
  );
  const [goalId, setGoalId] = useState<string | null>(initial?.savings_goal_id ?? null);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; day?: string; save?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: goals } = useGoals();
  const save = useSaveIncomeSource();
  const remove = useDeleteIncomeSource();

  // Goals that can still take money, plus the one already chosen (so it stays visible even if full).
  const choices = (goals ?? []).filter((g) => g.id === goalId || !goalProgress(g, 0).completed);

  const incomePaise = parseRupees(amount);
  const savePaise = parseRupees(saveAmount);
  const leftToSpend = incomePaise && savePaise && savePaise <= incomePaise ? incomePaise - savePaise : null;

  const onSave = () => {
    const dayNum = Number(day);
    const next = {
      name: name.trim() ? undefined : 'Enter a name',
      amount: incomePaise ? undefined : 'Enter an amount greater than 0',
      day: Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31 ? undefined : 'Enter a day from 1 to 31',
      save: !saveOn
        ? undefined
        : !savePaise
          ? 'Enter how much to save each month'
          : incomePaise && savePaise > incomePaise
            ? 'You cannot save more than the income itself'
            : !goalId
              ? 'Choose a goal to save for'
              : undefined,
    };
    setErrors(next);
    if (next.name || next.amount || next.day || next.save || !incomePaise) return;
    setFormError(null);

    save.mutate(
      {
        id: initial?.id,
        name: name.trim(),
        amount_paise: incomePaise,
        day_of_month: dayNum,
        active,
        savings_paise: saveOn && savePaise ? savePaise : 0,
        savings_goal_id: saveOn ? goalId : null,
      },
      { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) },
    );
  };

  const onDelete = () =>
    Alert.alert('Delete income source?', 'Income already added to your transactions is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(initial!.id, {
            onSuccess: () => router.back(),
            onError: (e) => setFormError(e.message),
          }),
      },
    ]);

  const row = [styles.switchRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <ThemedText themeColor="textSecondary">
        Money that arrives every month, like an allowance or salary. It&apos;s added to your transactions
        automatically on the chosen day.
      </ThemedText>

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Dad" maxLength={60} error={errors.name} />
      <Field
        label="Amount per month (₹)"
        value={amount}
        onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
        keyboardType="decimal-pad"
        placeholder="10000"
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
        <View style={row}>
          <View style={styles.flex}>
            <ThemedText>Save part of this income</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Set money aside every month for a goal
            </ThemedText>
          </View>
          <Switch value={saveOn} onValueChange={setSaveOn} trackColor={{ true: theme.primary }} />
        </View>

        {saveOn ? (
          <>
            <Field
              label="Save each month (₹)"
              value={saveAmount}
              onChangeText={(t) => setSaveAmount(sanitizeAmountInput(t))}
              keyboardType="decimal-pad"
              placeholder="2000"
              error={errors.save}
            />
            {leftToSpend !== null ? (
              <ThemedText type="small" themeColor="textSecondary">
                You&apos;ll have {formatPaise(leftToSpend)} left to spend each month.
              </ThemedText>
            ) : null}

            <ThemedText type="smallBold">Save for</ThemedText>
            {choices.length === 0 ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  You don&apos;t have a goal yet. Create one, then come back and choose it.
                </ThemedText>
                <Button variant="ghost" title="Create a goal" onPress={() => router.push('/goal')} />
              </>
            ) : (
              <View style={styles.wrap}>
                {choices.map((g) => (
                  <Chip key={g.id} label={g.name} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />
                ))}
                <Chip label="+ New goal" selected={false} onPress={() => router.push('/goal')} />
              </View>
            )}
          </>
        ) : null}
      </View>

      <View style={row}>
        <View style={styles.flex}>
          <ThemedText>Active</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Turn off to pause without deleting
          </ThemedText>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: theme.primary }} />
      </View>

      {formError ? <ErrorText>{formError}</ErrorText> : null}

      <Button title={isEdit ? 'Save changes' : 'Add income source'} onPress={onSave} loading={save.isPending} />
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
  group: { gap: Spacing.three },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
});
