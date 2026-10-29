import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field } from '@/components/form';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useArchiveCategory,
  useCategories,
  useSaveCategory,
  type CategoryKind,
} from '@/features/categories/api';
import { CategoryIcon } from '@/features/categories/category-icon';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/features/categories/options';

export default function EditCategoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { data } = useCategories();
  const existing = params.id ? data?.find((c) => c.id === params.id) : undefined;
  const isEdit = Boolean(params.id);

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<CategoryKind>(
    existing?.kind ?? (params.kind === 'income' ? 'income' : 'expense'),
  );
  const [icon, setIcon] = useState(existing?.icon ?? CATEGORY_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[7]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const save = useSaveCategory();
  const archive = useArchiveCategory();

  // Category list still loading on a deep link / reload: wait rather than show an empty form.
  if (isEdit && !existing) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </View>
    );
  }

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return setNameError('Enter a name');
    if (trimmed.length > 40) return setNameError('Keep it under 40 characters');
    setNameError(null);
    setFormError(null);
    save.mutate(
      { id: params.id, name: trimmed, kind, icon, color },
      { onSuccess: () => router.back(), onError: (e) => setFormError(e.message) },
    );
  };

  const onArchive = () =>
    Alert.alert(
      'Archive category?',
      'It will disappear from pickers. Past transactions keep their category.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            archive.mutate(params.id!, {
              onSuccess: () => router.back(),
              onError: (e) => setFormError(e.message),
            }),
        },
      ],
    );

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: isEdit ? 'Edit category' : 'New category' }} />
      <KeyboardAwareScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
          <View style={styles.preview}>
            <CategoryIcon icon={icon} color={color} size={64} />
            <ThemedText type="smallBold" themeColor="textSecondary">
              {name.trim() || 'Category name'}
            </ThemedText>
          </View>

          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Snacks"
            maxLength={40}
            error={nameError ?? undefined}
          />

          <View style={styles.group}>
            <ThemedText type="smallBold">Type</ThemedText>
            <Segmented
              value={kind}
              onChange={setKind}
              disabled={isEdit}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
            {isEdit ? (
              <ThemedText type="small" themeColor="textSecondary">
                Type can&apos;t be changed after creation.
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.group}>
            <ThemedText type="smallBold">Color</ThemedText>
            <View style={styles.grid}>
              {CATEGORY_COLORS.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }]}>
                  {c === color ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <ThemedText type="smallBold">Icon</ThemedText>
            <View style={styles.grid}>
              {CATEGORY_ICONS.map((i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Icon ${i}`}
                  onPress={() => setIcon(i)}
                  style={[
                    styles.iconCell,
                    { backgroundColor: theme.backgroundElement },
                    i === icon && { borderColor: color, borderWidth: 2 },
                  ]}>
                  <Ionicons name={i} size={22} color={i === icon ? color : theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>

          {formError ? <ErrorText>{formError}</ErrorText> : null}

          <Button title={isEdit ? 'Save changes' : 'Add category'} onPress={onSave} loading={save.isPending} />
          {isEdit ? (
            <Button variant="ghost" title="Archive category" onPress={onArchive} loading={archive.isPending} />
          ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  preview: { alignItems: 'center', gap: Spacing.two },
  group: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconCell: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
