import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/form';
import { PickerModal, type PickerOption } from '@/components/picker-modal';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/dates';
import { formatPaise } from '@/lib/money';

import { isMappingUsable, type AmountMode, type Mapping } from './columns';
import { normalizeRows } from './normalize';

const NONE = '-1';

function ColumnField({
  label,
  value,
  options,
  optional,
  onChange,
}: {
  label: string;
  value: number;
  options: PickerOption[];
  optional?: boolean;
  onChange: (col: number) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === String(value));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            {label}
          </ThemedText>
          <ThemedText type="smallBold" style={value < 0 ? { color: theme.textSecondary } : undefined}>
            {current?.label ?? (optional ? 'Not used' : 'Choose a column')}
          </ThemedText>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>
      <PickerModal
        visible={open}
        title={label}
        selected={String(value)}
        options={optional ? [{ value: NONE, label: 'Not used' }, ...options] : options}
        onClose={() => setOpen(false)}
        onSelect={(v) => {
          onChange(Number(v));
          setOpen(false);
        }}
      />
    </>
  );
}

export function MappingStep({
  fileName,
  rows,
  headerIndex,
  onHeaderIndex,
  mapping,
  onMapping,
  onContinue,
  busy,
}: {
  fileName: string;
  rows: string[][];
  headerIndex: number;
  onHeaderIndex: (index: number) => void;
  mapping: Mapping;
  onMapping: (m: Mapping) => void;
  onContinue: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const headers = rows[headerIndex] ?? [];
  const sample = rows[headerIndex + 1] ?? [];

  const options = useMemo<PickerOption[]>(
    () => headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}`, hint: sample[i] ? `e.g. ${sample[i]}` : undefined })),
    [headers, sample],
  );

  const preview = useMemo(
    () => (isMappingUsable(mapping) ? normalizeRows(rows, headerIndex, mapping) : { good: [], bad: [] }),
    [rows, headerIndex, mapping],
  );
  const usable = isMappingUsable(mapping);
  const set = (patch: Partial<Mapping>) => onMapping({ ...mapping, ...patch });

  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <View style={styles.gap}>
      <ThemedText themeColor="textSecondary">
        {fileName} · {rows.length - headerIndex - 1} rows. Check that each column is matched correctly. We&apos;ll
        remember this for next time.
      </ThemedText>

      <View style={[card, styles.headerRow]}>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            Column names are on row
          </ThemedText>
          <ThemedText type="smallBold">{headerIndex + 1}</ThemedText>
        </View>
        <Pressable accessibilityLabel="Header row up" hitSlop={10} disabled={headerIndex === 0} onPress={() => onHeaderIndex(headerIndex - 1)}>
          <Ionicons name="chevron-up-circle-outline" size={28} color={headerIndex === 0 ? theme.border : theme.text} />
        </Pressable>
        <Pressable accessibilityLabel="Header row down" hitSlop={10} disabled={headerIndex >= rows.length - 2} onPress={() => onHeaderIndex(headerIndex + 1)}>
          <Ionicons name="chevron-down-circle-outline" size={28} color={headerIndex >= rows.length - 2 ? theme.border : theme.text} />
        </Pressable>
      </View>

      <ColumnField label="Date" value={mapping.dateCol} options={options} onChange={(c) => set({ dateCol: c })} />
      <ColumnField label="Description" value={mapping.descCol} options={options} optional onChange={(c) => set({ descCol: c })} />

      <View style={styles.gapSmall}>
        <ThemedText type="smallBold">How are amounts shown?</ThemedText>
        <Segmented<AmountMode>
          value={mapping.amountMode}
          onChange={(amountMode) => set({ amountMode })}
          options={[
            { value: 'split', label: 'Debit / Credit' },
            { value: 'signed', label: 'One column' },
            { value: 'typed', label: 'With Dr/Cr' },
          ]}
        />
      </View>

      {mapping.amountMode === 'split' ? (
        <>
          <ColumnField label="Debit (money out)" value={mapping.debitCol} options={options} optional onChange={(c) => set({ debitCol: c })} />
          <ColumnField label="Credit (money in)" value={mapping.creditCol} options={options} optional onChange={(c) => set({ creditCol: c })} />
        </>
      ) : (
        <>
          <ColumnField label="Amount" value={mapping.amountCol} options={options} onChange={(c) => set({ amountCol: c })} />
          {mapping.amountMode === 'typed' ? (
            <ColumnField label="Debit / Credit marker" value={mapping.typeCol} options={options} onChange={(c) => set({ typeCol: c })} />
          ) : (
            <View style={[card, styles.headerRow]}>
              <View style={styles.flex}>
                <ThemedText>Positive amounts are expenses</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Turn on if your bank shows spending as plain numbers and deposits as negative.
                </ThemedText>
              </View>
              <Switch value={mapping.flipSign} onValueChange={(flipSign) => set({ flipSign })} trackColor={{ true: theme.primary }} />
            </View>
          )}
        </>
      )}

      <View style={[card, styles.headerRow]}>
        <View style={styles.flex}>
          <ThemedText>Day comes first</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            On means 05/09/2026 is 5 September. Off means May 9.
          </ThemedText>
        </View>
        <Switch value={mapping.dayFirst} onValueChange={(dayFirst) => set({ dayFirst })} trackColor={{ true: theme.primary }} />
      </View>

      <View style={card}>
        <ThemedText type="smallBold">Preview</ThemedText>
        {!usable ? (
          <ThemedText themeColor="textSecondary">Choose the date and amount columns to see a preview.</ThemedText>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {preview.good.length} readable · {preview.bad.length} can&apos;t be read
            </ThemedText>
            {preview.good.slice(0, 4).map((r) => (
              <View key={r.rowIndex} style={styles.previewRow}>
                <View style={styles.flex}>
                  <ThemedText type="small" numberOfLines={1}>
                    {r.description || 'No description'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {dayLabel(r.date)}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" style={r.type === 'income' ? { color: theme.primary } : undefined}>
                  {r.type === 'income' ? '+' : '-'}
                  {formatPaise(r.amountPaise)}
                </ThemedText>
              </View>
            ))}
            {preview.good.length === 0 ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {preview.bad[0]?.reason ?? 'No rows could be read.'} Try a different column, header row, or date order.
              </ThemedText>
            ) : null}
          </>
        )}
      </View>

      <Button title="Continue" onPress={onContinue} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: Spacing.three },
  gapSmall: { gap: Spacing.two },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: 14, borderWidth: 1, padding: Spacing.three },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
