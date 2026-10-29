import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { FEEDBACK_URL, PRIVACY_POLICY_URL } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { ensureNotificationPermission, useAlertsEnabled } from '@/features/budget/alert-notifications';
import { useCarryAmount, useCarryEnabled, useSetCarryForward } from '@/features/budget/carry';
import { exportTransactionsCsv } from '@/features/import/export';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { monthRange } from '@/lib/dates';
import { formatPaise } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const carryQuery = useCarryEnabled();
  const carryEnabled = Boolean(carryQuery.data);
  const { data: carryAmount } = useCarryAmount();
  const setCarry = useSetCarryForward();

  const name = session?.user.user_metadata?.display_name as string | undefined;
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  const [alertsEnabled, setAlertsOn] = useAlertsEnabled();
  const onToggleAlerts = async (next: boolean) => {
    await setAlertsOn(next);
    if (next && !(await ensureNotificationPermission(true))) {
      Alert.alert(
        'Notifications are off',
        'Alerts will still show on the Home screen. To get notifications too, allow them for Spendly in your phone settings.',
      );
    }
  };

  const [exporting, setExporting] = useState(false);
  const runExport = async (range?: { from: string; to: string }) => {
    setExporting(true);
    try {
      const count = await exportTransactionsCsv(range);
      if (count === 0) Alert.alert('Nothing to export', 'There are no transactions in that period.');
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };
  const chooseExport = () =>
    Alert.alert('Export transactions', 'Which transactions do you want to export?', [
      { text: 'This month', onPress: () => runExport(monthRange(0)) },
      { text: 'All time', onPress: () => runExport() },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const openLink = (url: string) =>
    Linking.openURL(url).catch(() => Alert.alert('Could not open the link', 'Please try again later.'));

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will need to log in again to see your data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            ACCOUNT
          </ThemedText>
          <View style={card}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 18 }}>
                {(name ?? session?.user.email ?? '?').charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.flex}>
              {name ? <ThemedText type="smallBold">{name}</ThemedText> : null}
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {session?.user.email}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            APPEARANCE
          </ThemedText>
          <Segmented options={THEME_OPTIONS} value={preference} onChange={setPreference} />
          <ThemedText type="small" themeColor="textSecondary">
            {preference === 'system' ? "Follows your phone's light or dark setting." : `Always ${preference}.`}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            BUDGET
          </ThemedText>
          <View style={card}>
            <View style={styles.flex}>
              <ThemedText>Carry forward leftover</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Money you didn&apos;t spend last month is added to this month&apos;s budget.
              </ThemedText>
              {carryEnabled && carryAmount ? (
                <ThemedText type="small" style={{ color: theme.primary }}>
                  This month: {formatPaise(carryAmount)} carried over
                </ThemedText>
              ) : null}
            </View>
            <Switch
              value={carryEnabled}
              disabled={setCarry.isPending || carryQuery.isLoading}
              onValueChange={(next) =>
                setCarry.mutate(next, {
                  onError: (e) => Alert.alert('Could not change this setting', e.message),
                })
              }
              trackColor={{ true: theme.primary }}
            />
          </View>
        </View>

        <View style={card}>
          <View style={styles.flex}>
            <ThemedText>Budget alerts</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              A notification when a budget reaches 80% and again at 100%.
            </ThemedText>
          </View>
          <Switch
            value={alertsEnabled === true}
            disabled={alertsEnabled === null}
            onValueChange={onToggleAlerts}
            trackColor={{ true: theme.primary }}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            DATA
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/categories')}
            style={({ pressed }) => [card, pressed && { opacity: 0.7 }]}>
            <Ionicons name="pricetags-outline" size={22} color={theme.textSecondary} />
            <ThemedText style={styles.flex}>Manage categories</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/import')}
            style={({ pressed }) => [card, pressed && { opacity: 0.7 }]}>
            <Ionicons name="cloud-upload-outline" size={22} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText>Import from CSV</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Bank statements and other apps
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={chooseExport}
            style={({ pressed }) => [card, (pressed || exporting) && { opacity: 0.7 }]}>
            <Ionicons name="cloud-download-outline" size={22} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText>{exporting ? 'Preparing export…' : 'Export transactions'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Share a CSV of your transactions
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>

        {PRIVACY_POLICY_URL || FEEDBACK_URL ? (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ABOUT
            </ThemedText>
            {FEEDBACK_URL ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => openLink(FEEDBACK_URL)}
                style={({ pressed }) => [card, pressed && { opacity: 0.7 }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.textSecondary} />
                <View style={styles.flex}>
                  <ThemedText>Send feedback</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Tell us what to fix or add
                  </ThemedText>
                </View>
                <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
            {PRIVACY_POLICY_URL ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => openLink(PRIVACY_POLICY_URL)}
                style={({ pressed }) => [card, pressed && { opacity: 0.7 }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color={theme.textSecondary} />
                <ThemedText style={styles.flex}>Privacy policy</ThemedText>
                <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Button variant="danger" title="Log out" onPress={confirmLogout} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} style={styles.deleteLink}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            Delete account
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
          Spendly {Constants.expoConfig?.version ?? ''}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: { letterSpacing: 1, fontSize: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  version: { textAlign: 'center' },
  deleteLink: { alignItems: 'center', paddingVertical: Spacing.two },
});
