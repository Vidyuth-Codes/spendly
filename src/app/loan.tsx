import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field } from '@/components/form';
import { ProgressBar } from '@/components/progress-bar';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Type } from '@/constants/theme';
import { loanBalance, type Loan, type LoanDirection } from '@/features/loans/balances';
import {
  useAddLoanPayment,
  useDeleteLoan,
  useDeleteLoanPayment,
  useLoans,
  useSaveLoan,
} from '@/features/loans/api';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, todayISO } from '@/lib/dates';
import { formatPaise, paiseToInput, parseRupees, sanitizeAmountInput } from '@/lib/money';

export default function LoanScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useLoans();
  const existing = id ? data?.find((l) => l.id === id) : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Loan' : 'New entry' }} />
      {id && isLoading ? <ActivityIndicator style={styles.center} /> : <LoanForm loan={existing} />}
    </SafeAreaView>
  );
}

function LoanForm({ loan }: { loan?: Loan }) {
  const router = useRouter();
  const theme = useTheme();
  const isEdit = Boolean(loan);

  const [direction, setDirection] = useState<LoanDirection>(loan?.direction ?? 'lent');
  const [person, setPerson] = useState(loan?.person ?? '');
  const [amount, setAmount] = useState(loan ? paiseToInput(loan.amount_paise) : '');
  const [note, setNote] = useState(loan?.note ?? '');
  const [repay, setRepay] = useState('');
  const [errors, setErrors] = useState<{ person?: string; amount?: string; repay?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const save = useSaveLoan();
  const remove = useDeleteLoan();
  const addPayment = useAddLoanPayment();
  const removePayment = useDeleteLoanPayment();

  const balance = loan ? loanBalance(loan) : null;
  const lent = direction === 'lent';
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  const onSave = () => {
    const paise = parseRupees(amount);
    const next = {
      person: person.trim() ? undefined : 'Enter a name',
      amount: !paise
        ? 'Enter an amount greater than 0'
        : balance && paise < balance.paidPaise
          ? `Already repaid ${formatPaise(balance.paidPaise)}, so it can't be lower than that`
          : undefined,
    };
    setErrors(next);
    if (next.person || next.amount || !paise) return;
    setFormError(null);
    save.mutate(
      { id: loan?.id, person, direction, amountPaise: paise, note: note.trim() || null, date: loan?.occurred_on ?? todayISO() },
      { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) },
    );
  };

  const onRepay = (all = false) => {
    const paise = all ? balance!.remainingPaise : parseRupees(repay);
    if (!paise) return setErrors((e) => ({ ...e, repay: 'Enter an amount greater than 0' }));
    if (paise > balance!.remainingPaise) {
      return setErrors((e) => ({ ...e, repay: `Only ${formatPaise(balance!.remainingPaise)} is left` }));
    }
    setErrors((e) => ({ ...e, repay: undefined }));
    addPayment.mutate(
      { loanId: loan!.id, amountPaise: paise },
      { onSuccess: () => setRepay(''), onError: (e) => setFormError(e.message) },
    );
  };

  const onDeletePayment = (paymentId: string) =>
    Alert.alert('Remove this repayment?', 'The balance goes back up.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePayment.mutate(paymentId, { onError: (e) => setFormError(e.message) }) },
    ]);

  const onDelete = () =>
    Alert.alert('Delete this entry?', 'Its repayment history is deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(loan!.id, { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) }) },
    ]);

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {balance && loan ? (
        <View style={card}>
          <ThemedText type="small" themeColor="textSecondary">
            {balance.settled ? 'Settled' : lent ? `${loan.person} still owes you` : `You still owe ${loan.person}`}
          </ThemedText>
          <ThemedText style={[styles.big, { color: balance.settled ? theme.textSecondary : lent ? theme.primary : theme.warning }]}>
            {formatPaise(balance.remainingPaise)}
          </ThemedText>
          <ProgressBar ratio={balance.ratio} />
          <ThemedText type="small" themeColor="textSecondary">
            {formatPaise(balance.paidPaise)} of {formatPaise(loan.amount_paise)} repaid
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.group}>
        <ThemedText type="smallBold">Type</ThemedText>
        <Segmented<LoanDirection>
          value={direction}
          onChange={setDirection}
          disabled={isEdit}
          options={[
            { value: 'lent', label: 'I lent' },
            { value: 'borrowed', label: 'I borrowed' },
          ]}
        />
      </View>

      <Field
        label={lent ? 'Who owes you?' : 'Who did you borrow from?'}
        value={person}
        onChangeText={setPerson}
        placeholder="e.g. Rahul"
        maxLength={60}
        error={errors.person}
      />
      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
        keyboardType="decimal-pad"
        placeholder="300"
        error={errors.amount}
      />
      <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={280} placeholder="What was it for?" multiline />

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button title={isEdit ? 'Save changes' : 'Add entry'} onPress={onSave} loading={save.isPending} />

      {loan && balance ? (
        <>
          {balance.settled ? null : (
            <View style={styles.group}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                {lent ? 'RECORD MONEY RECEIVED' : 'RECORD MONEY PAID BACK'}
              </ThemedText>
              <View style={styles.repayRow}>
                <View style={styles.flex}>
                  <Field
                    label="Amount (₹)"
                    value={repay}
                    onChangeText={(t) => setRepay(sanitizeAmountInput(t))}
                    keyboardType="decimal-pad"
                    placeholder="100"
                    error={errors.repay}
                  />
                </View>
                <View style={styles.repayButton}>
                  <Button title="Add" onPress={() => onRepay(false)} loading={addPayment.isPending} />
                </View>
              </View>
              <Button variant="ghost" title={`Mark fully ${lent ? 'received' : 'paid back'} (${formatPaise(balance.remainingPaise)})`} onPress={() => onRepay(true)} />
            </View>
          )}

          <View style={styles.group}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              HISTORY
            </ThemedText>
            {loan.payments.length === 0 ? (
              <ThemedText themeColor="textSecondary">No repayments yet.</ThemedText>
            ) : (
              loan.payments.map((p) => (
                <View key={p.id} style={[card, styles.historyRow]}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{formatPaise(p.amount_paise)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {dayLabel(p.paid_on)}
                    </ThemedText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove this repayment" hitSlop={10} onPress={() => onDeletePayment(p.id)}>
                    <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <Button variant="danger" title="Delete entry" onPress={onDelete} loading={remove.isPending} />
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
  card: { borderRadius: 20, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  big: { fontFamily: Type.displayHeavy, fontSize: 36, lineHeight: 44 },
  group: { gap: Spacing.two },
  label: { letterSpacing: 1, fontSize: 12 },
  repayRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  repayButton: { width: 96 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
