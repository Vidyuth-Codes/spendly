import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Button, ErrorText, Field } from '@/components/form';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Type } from '@/constants/theme';
import { activeCategories, useCategories } from '@/features/categories/api';
import {
  PAYMENT_METHODS,
  useDeleteTransaction,
  useSaveTransaction,
  useTransaction,
  type PaymentMethod,
  type Transaction,
  type TxnType,
} from '@/features/transactions/api';
import { ReceiptField } from '@/features/receipts/receipt-field';
import { TagInput } from '@/features/tags/tag-input';
import { useMyTags } from '@/features/tags/api';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, fromISODate, todayISO, toISODate } from '@/lib/dates';
import { paiseToInput, parseRupees, sanitizeAmountInput } from '@/lib/money';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading, error } = useTransaction(id);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Edit transaction' : 'New transaction' }} />
      {id && isLoading ? (
        <ActivityIndicator style={styles.center} />
      ) : id && (error || !data) ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">This transaction could not be loaded.</ThemedText>
        </View>
      ) : (
        <TransactionForm initial={data} />
      )}
    </SafeAreaView>
  );
}

function TransactionForm({ initial }: { initial?: Transaction }) {
  const router = useRouter();
  const theme = useTheme();
  const isEdit = Boolean(initial);

  const [type, setType] = useState<TxnType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial ? paiseToInput(initial.amount_paise) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [method, setMethod] = useState<PaymentMethod>(initial?.payment_method ?? 'upi');
  const [date, setDate] = useState(initial?.occurred_on ?? todayISO());
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  // Receipt: the stored path, plus either a newly chosen photo or a request to drop the stored one.
  const [newReceipt, setNewReceipt] = useState<string | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);
  const storedReceipt = receiptRemoved ? null : (initial?.receipt_path ?? null);
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: cats } = useCategories();
  const { data: myTags } = useMyTags();
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  // Pickers show active categories of the chosen type, plus the current one if it was archived.
  const choices = activeCategories(cats, type);
  const current = categoryId ? cats?.find((c) => c.id === categoryId) : undefined;
  if (current && !choices.some((c) => c.id === current.id) && current.kind === type) choices.unshift(current);

  const onType = (next: TxnType) => {
    setType(next);
    if (current && current.kind !== next) setCategoryId(null);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromISODate(date),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) setDate(toISODate(picked));
        },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  };

  const onSave = () => {
    const paise = parseRupees(amount);
    if (!paise) return setAmountError('Enter an amount greater than 0');
    setAmountError(null);
    setFormError(null);

    save.mutate(
      {
        id: initial?.id,
        type,
        amount_paise: paise,
        category_id: categoryId,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        payment_method: method,
        occurred_on: date,
        tags,
        receipt: newReceipt
          ? { kind: 'replace', uri: newReceipt, previousPath: initial?.receipt_path ?? null }
          : receiptRemoved && initial?.receipt_path
            ? { kind: 'remove', previousPath: initial.receipt_path }
            : { kind: 'keep' },
      },
      { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) },
    );
  };

  const onDelete = () =>
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate({ id: initial!.id, receiptPath: initial!.receipt_path }, {
            onSuccess: () => router.back(),
            onError: (e) => setFormError(e.message),
          }),
      },
    ]);

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
        <Segmented
          value={type}
          onChange={onType}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />

        <View style={styles.amountBox}>
          <ThemedText type="small" themeColor="textSecondary">
            Amount
          </ThemedText>
          <View style={styles.amountRow}>
            <ThemedText style={styles.rupee}>₹</ThemedText>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              autoFocus={!isEdit}
              style={[styles.amountInput, { color: theme.text }]}
            />
          </View>
          {amountError ? <ErrorText>{amountError}</ErrorText> : null}
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

        <Field
          label={type === 'expense' ? 'Paid to (optional)' : 'Received from (optional)'}
          value={merchant}
          onChangeText={setMerchant}
          maxLength={80}
          placeholder={type === 'expense' ? 'e.g. Swiggy' : 'e.g. Dad'}
        />

        <View style={styles.group}>
          <ThemedText type="smallBold">Date</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={openDatePicker}
            style={[styles.dateButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
            <ThemedText>{dayLabel(date)}</ThemedText>
          </Pressable>
          {showIosPicker && Platform.OS === 'ios' ? (
            <DateTimePicker
              value={fromISODate(date)}
              mode="date"
              display="inline"
              maximumDate={new Date()}
              onChange={(_e, picked) => picked && setDate(toISODate(picked))}
            />
          ) : null}
        </View>

        <View style={styles.group}>
          <ThemedText type="smallBold">Payment method</ThemedText>
          <View style={styles.wrap}>
            {PAYMENT_METHODS.map((m) => (
              <Chip key={m.value} label={m.label} selected={method === m.value} onPress={() => setMethod(m.value)} />
            ))}
          </View>
        </View>

        <Field
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={280}
          placeholder="Anything to remember"
          multiline
        />

        <View style={styles.group}>
          <ThemedText type="smallBold">Tags (optional)</ThemedText>
          <TagInput tags={tags} onChange={setTags} suggestions={(myTags ?? []).map((t) => t.tag)} />
          <ThemedText type="small" themeColor="textSecondary">
            Group spending across categories, like #trip-goa, then see the total in Insights.
          </ThemedText>
        </View>

        <View style={styles.group}>
          <ThemedText type="smallBold">Receipt (optional)</ThemedText>
          <ReceiptField
            path={storedReceipt}
            localUri={newReceipt}
            onPick={(uri) => setNewReceipt(uri)}
            onRemove={() => {
              setNewReceipt(null);
              setReceiptRemoved(true);
            }}
          />
        </View>

        {formError ? <ErrorText>{formError}</ErrorText> : null}

        <Button title={isEdit ? 'Save changes' : 'Add transaction'} onPress={onSave} loading={save.isPending} />
        {isEdit ? (
          <Button variant="ghost" title="Delete transaction" onPress={onDelete} loading={remove.isPending} />
        ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  amountBox: { alignItems: 'center', gap: Spacing.one },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rupee: { fontFamily: Type.display, fontSize: 36, lineHeight: 44 },
  amountInput: { fontFamily: Type.displayHeavy, fontSize: 44, minWidth: 80, paddingVertical: 0 },
  group: { gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
});
