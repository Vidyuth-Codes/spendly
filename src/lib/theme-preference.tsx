import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'spendly.theme';

type Value = { preference: ThemePreference; setPreference: (p: ThemePreference) => void; ready: boolean };

const ThemePreferenceContext = createContext<Value>({ preference: 'system', setPreference: () => {}, ready: false });

const isPreference = (v: unknown): v is ThemePreference => v === 'system' || v === 'light' || v === 'dark';

/**
 * Remembers the user's light/dark/system choice and applies it app-wide. Setting Appearance's scheme
 * makes React Native's useColorScheme (used by every themed component) and native pieces such as the
 * date picker follow the choice; 'unspecified' hands control back to the phone's setting.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => active && isPreference(stored) && setPreferenceState(stored))
      .catch(() => {}) // storage unavailable: fall back to following the system
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ preference, setPreference, ready }), [preference, setPreference, ready]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export const useThemePreference = () => useContext(ThemePreferenceContext);
