import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { activeCategories, useCategories, type CategoryKind } from '@/features/categories/api';
import { CategoryIcon } from '@/features/categories/category-icon';

export default function CategoriesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { data, isLoading, error, refetch, isRefetching } = useCategories();
  const rows = activeCategories(data, kind);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.top}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.center} color={theme.primary} />
      ) : error ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">Could not load categories.</ThemedText>
          <Button variant="ghost" title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              No {kind} categories yet.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/categories/edit', params: { id: item.id } })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}>
              <CategoryIcon icon={item.icon} color={item.color} />
              <ThemedText style={styles.name}>{item.name}</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        />
      )}

      <View style={styles.footer}>
        <Button
          title={`Add ${kind} category`}
          onPress={() => router.push({ pathname: '/categories/edit', params: { kind } })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.three },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
  },
  name: { flex: 1 },
  footer: { padding: Spacing.four },
});
