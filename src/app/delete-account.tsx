import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { removeAllMyReceipts } from '@/features/receipts/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const CONFIRM_WORD = 'DELETE';

const DELETED = [
  'Your account and login',
  'All transactions and categories',
  'Budgets, income sources, recurring expenses and savings goals',
  'Lent and borrowed entries, tags and receipt photos',
  'Remembered merchants and settings',
];

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = text.trim().toUpperCase() === CONFIRM_WORD;

  const onDelete = async () => {
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    // Receipt photos live in file storage, which deleting the account row does not clean up.
    try {
      if (userId) await removeAllMyReceipts(userId);
    } catch (e) {
      setBusy(false);
      return setError(e instanceof Error ? e.message : 'Could not remove your receipt photos. Try again.');
    }
    const { error: rpcError } = await supabase.rpc('delete_my_account');
    if (rpcError) {
      setBusy(false);
      return setError(rpcError.message);
    }
    // The account is gone. Clear everything held on the phone; signing out returns to the login screen.
    client.clear();
    await supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Delete account' }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            This permanently deletes everything
          </ThemedText>
          <ThemedText themeColor="textSecondary">It cannot be undone, and we cannot recover it for you. This removes:</ThemedText>
          {DELETED.map((line) => (
            <ThemedText key={line} type="small">
              • {line}
            </ThemedText>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Export your transactions first from Settings if you want to keep a copy.
          </ThemedText>
        </View>

        <Field
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={text}
          onChangeText={setText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
        />

        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button variant="danger" title="Delete my account" disabled={!confirmed} loading={busy} onPress={onDelete} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  card: { borderRadius: 18, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
});
