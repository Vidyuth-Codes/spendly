import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PickerOption = { value: string; label: string; hint?: string };

/** A bottom sheet that lists options and reports the tapped one. */
export function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.two },
        ]}>
        <View style={styles.handle} />
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(item.value)}
              style={({ pressed }) => [styles.row, { borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
              <View style={styles.flex}>
                <ThemedText>{item.label}</ThemedText>
                {item.hint ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.hint}
                  </ThemedText>
                ) : null}
              </View>
              {item.value === selected ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#8C96A8', opacity: 0.5, marginVertical: Spacing.two },
  title: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
