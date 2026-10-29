import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { activeCategories, useCategories } from '@/features/categories/api';
import {
  fetchExisting,
  loadSavedMapping,
  saveMapping,
  useImportTransactions,
  useMerchantRules,
} from '@/features/import/api';
import { extractPayee, guessPaymentMethod, pickCategoryId } from '@/features/import/categorize';
import { detectHeaderRow, guessMapping, mappingKey, type Mapping } from '@/features/import/columns';
import { parseCsv } from '@/features/import/csv';
import { MappingStep } from '@/features/import/mapping-step';
import { assignKeys, normalizeRows, type BadRow } from '@/features/import/normalize';
import { ReviewStep, type ReviewItem } from '@/features/import/review-step';
import { useTheme } from '@/hooks/use-theme';

type Step = 'pick' | 'map' | 'review' | 'done';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 10_000;

export default function ImportScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [bad, setBad] = useState<BadRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const { data: cats } = useCategories();
  const { data: rules } = useMerchantRules();
  const importMutation = useImportTransactions();
  const categories = activeCategories(cats);

  /** Picks the header row, guessing the mapping (or reusing what was confirmed for this layout before). */
  const setupHeader = async (allRows: string[][], index: number) => {
    const headers = allRows[index] ?? [];
    const saved = await loadSavedMapping(mappingKey(headers));
    setHeaderIndex(index);
    setMapping(saved ?? guessMapping(headers));
  };

  const pickFile = async () => {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];

      if (/\.(xlsx?|pdf|numbers)$/i.test(asset.name)) {
        return setError('That looks like an Excel or PDF file. Open it and save or export it as CSV, then try again.');
      }
      if (asset.size && asset.size > MAX_BYTES) return setError('That file is too large (over 8 MB). Try a shorter date range.');

      setBusy(true);
      const parsed = parseCsv(await new File(asset.uri).text());
      if (parsed.length < 2) return setError('No transactions found in that file. Is it a CSV export?');

      setFileName(asset.name);
      setRows(parsed);
      await setupHeader(parsed, detectHeaderRow(parsed));
      setStep('map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const continueToReview = async () => {
    if (!mapping) return;
    setError(null);
    setBusy(true);
    try {
      const { good, bad: unreadable } = normalizeRows(rows, headerIndex, mapping);
      if (good.length === 0) return setError('No rows could be read with these settings. Check the columns and date order.');
      if (good.length > MAX_ROWS) return setError(`That file has ${good.length} transactions. Import up to ${MAX_ROWS} at a time.`);

      await saveMapping(mappingKey(rows[headerIndex] ?? []), mapping);

      const keyed = assignKeys(good);
      const dates = good.map((r) => r.date).sort();
      const existing = await fetchExisting(dates[0], dates[dates.length - 1]);
      const refs = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }));

      setItems(
        keyed.map((r, id) => {
          const payee = extractPayee(r.description);
          const status = existing.hashes.has(r.key)
            ? 'imported'
            : existing.manual.has(`${r.date}|${r.type}|${r.amountPaise}`)
              ? 'possible'
              : 'new';
          return {
            id,
            rowIndex: r.rowIndex,
            key: r.key,
            date: r.date,
            type: r.type,
            amountPaise: r.amountPaise,
            description: r.description,
            merchant: payee?.merchant ?? (r.description ? r.description.slice(0, 80) : null),
            keyword: payee?.keyword ?? null,
            categoryId: pickCategoryId(r.description, r.type, rules ?? [], refs),
            paymentMethod: guessPaymentMethod(r.description),
            status,
            selected: status === 'new',
          };
        }),
      );
      setBad(unreadable.map((b) => ({ ...b })));
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong preparing the import.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('pick');
    setError(null);
    setItems([]);
    setBad([]);
    setResult(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={step === 'review' ? [] : ['bottom']}>
      <Stack.Screen options={{ title: step === 'review' ? 'Review' : 'Import transactions' }} />

      {step === 'review' ? (
        <>
          {error ? (
            <View style={styles.errorBar}>
              <ErrorText>{error}</ErrorText>
            </View>
          ) : null}
          <ReviewStep
            initial={items}
            bad={bad}
            categories={categories}
            importing={importMutation.isPending}
            onBack={() => setStep('map')}
            onImport={(chosen, learn) => {
              setError(null);
              importMutation.mutate(
                { rows: chosen, learn },
                {
                  onSuccess: (r) => {
                    setResult(r);
                    setStep('done');
                  },
                  onError: (e) => setError(e.message),
                },
              );
            }}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'pick' ? (
            <>
              <View style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Ionicons name="document-text-outline" size={34} color={theme.primary} />
                <ThemedText type="smallBold">Import from a bank statement or another app</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Choose a CSV file. You&apos;ll match its columns, review every transaction, and fix categories before
                  anything is saved.
                </ThemedText>
              </View>
              <View style={styles.tips}>
                <Tip text="Download your statement as CSV from net banking (most banks offer it next to PDF)." />
                <Tip text="Importing the same statement twice is safe. Duplicates are skipped." />
                <Tip text="Your file is read on your phone. Only the transactions you confirm are saved." />
              </View>
              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button title="Choose CSV file" onPress={pickFile} loading={busy} />
            </>
          ) : null}

          {step === 'map' && mapping ? (
            <>
              {error ? <ErrorText>{error}</ErrorText> : null}
              <MappingStep
                fileName={fileName}
                rows={rows}
                headerIndex={headerIndex}
                onHeaderIndex={(i) => setupHeader(rows, i)}
                mapping={mapping}
                onMapping={setMapping}
                onContinue={continueToReview}
                busy={busy}
              />
              <Button variant="ghost" title="Choose a different file" onPress={reset} />
            </>
          ) : null}

          {step === 'done' && result ? (
            <>
              <View style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Ionicons name="checkmark-circle" size={44} color={theme.primary} />
                <ThemedText type="subtitle">
                  {result.inserted} imported
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  {result.skipped > 0
                    ? `${result.skipped} were skipped because they had already been imported.`
                    : 'Everything you selected was added to your transactions.'}
                </ThemedText>
              </View>
              <Button title="View transactions" onPress={() => router.replace('/transactions')} />
              <Button variant="ghost" title="Import another file" onPress={reset} />
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Tip({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.tip}>
      <Ionicons name="checkmark" size={18} color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  hero: { borderRadius: 22, borderWidth: 1, padding: Spacing.four, gap: Spacing.two, alignItems: 'flex-start' },
  tips: { gap: Spacing.two },
  tip: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  errorBar: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
});
