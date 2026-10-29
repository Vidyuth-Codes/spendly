import { DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthShell } from '@/components/auth-shell';
import { BudgetAlertWatcher } from '@/components/budget-alert-watcher';
import { OfflineBanner } from '@/components/offline-banner';
import { RecurringIncomeSync } from '@/components/recurring-income-sync';
import { Colors, Type } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/theme-preference';

SplashScreen.preventAutoHideAsync();

/** React Navigation themes carrying the Midnight colors, so headers and page backgrounds match. */
const navTheme = (base: Theme, c: (typeof Colors)['light' | 'dark']): Theme => ({
  ...base,
  colors: {
    ...base.colors,
    primary: c.primary,
    background: c.background,
    card: c.background,
    text: c.text,
    border: c.border,
  },
});
const LightNav = navTheme(DefaultTheme, Colors.light);
const DarkNav = navTheme(DarkTheme, Colors.dark);

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <>
      {session ? <RecurringIncomeSync /> : null}
      {session ? <BudgetAlertWatcher /> : null}
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: Type.bodyBold },
        }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="categories" />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="transaction" options={{ headerShown: true, title: 'Transaction' }} />
          <Stack.Screen name="income-source" options={{ headerShown: true, title: 'Income' }} />
          <Stack.Screen name="budget-limit" options={{ headerShown: true, title: 'Budget' }} />
          <Stack.Screen name="goal" options={{ headerShown: true, title: 'Savings goal' }} />
          <Stack.Screen name="import" options={{ headerShown: true, title: 'Import transactions' }} />
          <Stack.Screen name="recurring-expense" options={{ headerShown: true, title: 'Recurring expense' }} />
          <Stack.Screen name="loans" options={{ headerShown: true, title: 'Lent & borrowed' }} />
          <Stack.Screen name="loan" options={{ headerShown: true, title: 'Loan' }} />
          <Stack.Screen name="delete-account" options={{ headerShown: true, title: 'Delete account' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function Shell({ fontsReady }: { fontsReady: boolean }) {
  const { ready: themeReady } = useThemePreference();
  const colorScheme = useColorScheme();

  // The splash screen stays up until fonts and the saved theme are in, so there is no flash.
  if (!fontsReady || !themeReady) return null;

  if (!isSupabaseConfigured) {
    SplashScreen.hideAsync();
    return (
      <AuthShell
        title="Supabase not configured"
        subtitle="Copy .env.example to .env, add your project URL and anon key, then restart Expo with: npx expo start -c"
      />
    );
  }

  return (
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkNav : LightNav}>
            <RootNavigator />
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </KeyboardProvider>
  );
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ DMSans_500Medium, DMSans_700Bold, Sora_700Bold, Sora_800ExtraBold });

  return (
    <ThemePreferenceProvider>
      {/* A font failure should not brick the app: fall back to system fonts. */}
      <Shell fontsReady={loaded || Boolean(fontError)} />
    </ThemePreferenceProvider>
  );
}
