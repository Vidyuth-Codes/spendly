import { Ionicons } from '@expo/vector-icons';
import { useOnlineManager } from '@/lib/use-online';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** A small pill above the tab bar while the phone has no connection. It never blocks touches. */
export function OfflineBanner() {
  const online = useOnlineManager();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  if (online) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 92 }]}>
      <View style={[styles.pill, { backgroundColor: theme.backgroundElement, borderColor: theme.warning }]}>
        <Ionicons name="cloud-offline-outline" size={16} color={theme.warning} />
        <ThemedText type="small">You&apos;re offline. Changes can&apos;t be saved right now.</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
});
