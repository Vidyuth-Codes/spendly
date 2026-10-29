import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { pickReceipt, useReceiptUrl, type ReceiptSource } from './api';

/**
 * Attach, view, replace or remove a receipt photo. `path` is the stored photo (shown through a
 * private link); `localUri` is a photo chosen but not saved yet and takes precedence.
 */
export function ReceiptField({
  path,
  localUri,
  onPick,
  onRemove,
}: {
  path: string | null;
  localUri: string | null;
  onPick: (uri: string) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [viewing, setViewing] = useState(false);
  const url = useReceiptUrl(localUri ? null : path);
  const shown = localUri ?? url.data ?? null;
  const loading = !localUri && Boolean(path) && url.isLoading;
  const hasReceipt = Boolean(localUri || path);

  const choose = async (source: ReceiptSource) => {
    try {
      const uri = await pickReceipt(source);
      if (uri) onPick(uri);
    } catch (e) {
      Alert.alert('Could not add the photo', e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const ask = () =>
    Alert.alert(hasReceipt ? 'Replace receipt' : 'Add receipt', undefined, [
      { text: 'Take photo', onPress: () => choose('camera') },
      { text: 'Choose from gallery', onPress: () => choose('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={styles.wrap}>
      {hasReceipt ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="View receipt"
            disabled={!shown}
            onPress={() => setViewing(true)}
            style={[styles.thumb, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            {shown ? (
              <Image source={{ uri: shown }} style={styles.image} contentFit="cover" />
            ) : loading ? (
              <ActivityIndicator color={theme.textSecondary} />
            ) : (
              <Ionicons name="alert-circle-outline" size={22} color={theme.textSecondary} />
            )}
          </Pressable>
          <View style={styles.actions}>
            <ThemedText type="smallBold">{localUri ? 'New photo (saved with the transaction)' : 'Receipt attached'}</ThemedText>
            <View style={styles.buttons}>
              <Pressable accessibilityRole="button" onPress={ask} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Replace
                </ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  Remove
                </ThemedText>
              </Pressable>
            </View>
            {!localUri && url.error ? (
              <ThemedText type="small" themeColor="textSecondary">
                Couldn&apos;t load the photo. Check your connection.
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={ask}
          style={[styles.add, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="camera-outline" size={22} color={theme.textSecondary} />
          <ThemedText>Add a receipt photo</ThemedText>
        </Pressable>
      )}

      <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)} statusBarTranslucent>
        <Pressable style={styles.viewer} onPress={() => setViewing(false)} accessibilityLabel="Close receipt">
          {shown ? <Image source={{ uri: shown }} style={styles.full} contentFit="contain" /> : null}
          <View style={styles.close}>
            <Ionicons name="close" size={26} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  thumb: { width: 84, height: 84, borderRadius: 14, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  actions: { flex: 1, gap: Spacing.one },
  buttons: { flexDirection: 'row', gap: Spacing.four },
  add: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 14, padding: Spacing.three },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '85%' },
  close: { position: 'absolute', top: 48, right: 20 },
});
