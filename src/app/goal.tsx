import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field } from '@/components/form';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Type } from '@/constants/theme';
import { useIncomeSources } from '@/features/budget/api';
import {
  useAddContribution,
  useDeleteContribution,
  useDeleteGoal,
  useGoals,
  useSaveGoal,
} from '@/features/savings/api';
import { goalEtaLabel, goalProgress, monthlyForGoal, type SavingsGoal } from '@/features/savings/progress';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/dates';
import { formatPaise, paiseToInput, parseRupees, sanitizeAmountInput } from '@/lib/money';

export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: goals, isLoading } = useGoals();
  const existing = id ? goals?.find((g) => g.id === id) : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Savings goal' : 'New goal' }} />
      {id && isLoading ? <ActivityIndicator style={styles.center} /> : <GoalForm goal={existing} />}
    </SafeAreaView>
  );
}

function GoalForm({ goal }: { goal?: SavingsGoal }) {
  const router = useRouter();
  const theme = useTheme();
  const isEdit = Boolean(goal);
  const { data: sources } = useIncomeSources();

  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? paiseToInput(goal.target_paise) : '');
  const [addAmount, setAddAmount] = useState('');
  const [errors, setErrors] = useState<{ name?: string; target?: string; add?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const save = useSaveGoal();
  const remove = useDeleteGoal();
  const add = useAddContribution();
  const removeContribution = useDeleteContribution();

  const progress = goal ? goalProgress(goal, monthlyForGoal(goal.id, sources ?? [])) : null;
  const sourceName = new Map((sources ?? []).map((s) => [s.id, s.name]));

  const onSave = () => {
    const targetPaise = parseRupees(target);
    const next = {
      name: name.trim() ? undefined : 'Give your goal a name',
      target: targetPaise ? undefined : 'Enter a target greater than 0',
    };
    setErrors(next);
    if (next.name || next.target || !targetPaise) return;
    setFormError(null);
    save.mutate(
      { id: goal?.id, name, targetPaise },
      { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) },
    );
  };

  const onAdd = () => {
    const paise = parseRupees(addAmount);
    if (!paise) return setErrors((e) => ({ ...e, add: 'Enter an amount greater than 0' }));
    setErrors((e) => ({ ...e, add: undefined }));
    add.mutate(
      { goalId: goal!.id, amountPaise: paise },
      { onSuccess: () => setAddAmount(''), onError: (e) => setFormError(e.message) },
    );
  };

  const onDeleteContribution = (contributionId: string) =>
    Alert.alert('Remove this amount?', 'It will no longer count towards the goal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeContribution.mutate(contributionId, { onError: (e) => setFormError(e.message) }),
      },
    ]);

  const onDeleteGoal = () =>
    Alert.alert('Delete this goal?', 'Its saving history is deleted too. Income sources saving for it stop saving.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(goal!.id, { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) }),
      },
    ]);

  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {progress ? (
        <View style={card}>
          <View style={styles.progressTop}>
            <ThemedText style={styles.percent}>{progress.percent}%</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {goalEtaLabel(progress) ?? 'No automatic saving set up'}
            </ThemedText>
          </View>
          <ProgressBar ratio={progress.ratio} />
          <View style={styles.progressBottom}>
            <ThemedText type="smallBold">{formatPaise(progress.savedPaise)} saved</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              of {formatPaise(progress.targetPaise)}
            </ThemedText>
          </View>
          {progress.monthlyPaise > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {formatPaise(progress.monthlyPaise)} is set aside for this goal every month.
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <ThemedText themeColor="textSecondary">
          Save up for something specific. After creating a goal, choose it on an income source to set money aside
          automatically every month.
        </ThemedText>
      )}

      <Field
        label="Goal name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. New phone"
        maxLength={60}
        error={errors.name}
      />
      <Field
        label="Target amount (₹)"
        value={target}
        onChangeText={(t) => setTarget(sanitizeAmountInput(t))}
        keyboardType="decimal-pad"
        placeholder="15000"
        error={errors.target}
      />

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button title={isEdit ? 'Save changes' : 'Create goal'} onPress={onSave} loading={save.isPending} />

      {goal && progress ? (
        <>
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ADD MONEY
            </ThemedText>
            <View style={styles.addRow}>
              <View style={styles.flex}>
                <Field
                  label="Amount (₹)"
                  value={addAmount}
                  onChangeText={(t) => setAddAmount(sanitizeAmountInput(t))}
                  keyboardType="decimal-pad"
                  placeholder="500"
                  error={errors.add}
                />
              </View>
              <View style={styles.addButton}>
                <Button title="Add" onPress={onAdd} loading={add.isPending} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              HISTORY
            </ThemedText>
            {goal.contributions.length === 0 ? (
              <ThemedText themeColor="textSecondary">Nothing saved yet.</ThemedText>
            ) : (
              goal.contributions.slice(0, 10).map((c) => (
                <View key={c.id} style={[card, styles.historyRow]}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">+{formatPaise(c.amount_paise)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {dayLabel(c.contributed_on)} ·{' '}
                      {c.income_source_id ? `Auto from ${sourceName.get(c.income_source_id) ?? 'income'}` : 'Added by you'}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove this amount"
                    hitSlop={10}
                    onPress={() => onDeleteContribution(c.id)}>
                    <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))
            )}
            {goal.contributions.length > 10 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Showing the latest 10 of {goal.contributions.length}.
              </ThemedText>
            ) : null}
          </View>

          <Button variant="danger" title="Delete goal" onPress={onDeleteGoal} loading={remove.isPending} />
        </>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  card: { borderRadius: 20, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  percent: { fontFamily: Type.displayHeavy, fontSize: 36, lineHeight: 44 },
  progressBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  section: { gap: Spacing.two },
  sectionLabel: { letterSpacing: 1, fontSize: 12 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  addButton: { width: 96 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
});
