import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Title row shared by the main tabs: the title on the left, the settings button on the right. */
export function ScreenHeader({
  title,
  accessory,
  titleSize,
}: {
  title: string;
  accessory?: ReactNode;
  /** Smaller title for screens that share the row with more controls (e.g. the Home greeting). */
  titleSize?: number;
}) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {/* A long title shrinks (down to 60%) to stay on one line instead of being cut off. */}
      <ThemedText
        type="subtitle"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[styles.title, titleSize ? { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.3) } : undefined]}>
        {title}
      </ThemedText>
      <View style={styles.right}>
        {accessory}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={[styles.iconButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="settings-outline" size={20} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  title: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
