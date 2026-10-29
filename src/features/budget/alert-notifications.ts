import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const ENABLED_KEY = 'spendly.alerts.enabled';
const ASKED_KEY = 'spendly.alerts.asked';
const sentKeyFor = (month: string) => `spendly.alerts.sent.${month}`;
const CHANNEL = 'budget-alerts';

// ------------------------------------------------------------ on/off preference

let enabledCache: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

export async function getAlertsEnabled(): Promise<boolean> {
  if (enabledCache !== null) return enabledCache;
  try {
    enabledCache = (await AsyncStorage.getItem(ENABLED_KEY)) !== 'off'; // on unless switched off
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

export async function setAlertsEnabled(value: boolean): Promise<void> {
  enabledCache = value;
  listeners.forEach((l) => l(value));
  try {
    await AsyncStorage.setItem(ENABLED_KEY, value ? 'on' : 'off');
  } catch {
    // keep the in-memory value; it just will not survive a restart
  }
}

/** [enabled, setEnabled]; `null` while the saved value is still loading. */
export function useAlertsEnabled(): [boolean | null, (v: boolean) => Promise<void>] {
  const [value, setValue] = useState<boolean | null>(enabledCache);
  useEffect(() => {
    let active = true;
    getAlertsEnabled().then((v) => active && setValue(v));
    listeners.add(setValue);
    return () => {
      active = false;
      listeners.delete(setValue);
    };
  }, []);
  return [value, setAlertsEnabled];
}

// ------------------------------------------------------------ already-told memory

export async function loadSent(month: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(sentKeyFor(month));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function saveSent(month: string, sent: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(sentKeyFor(month), JSON.stringify([...sent]));
  } catch {
    // worst case a notification repeats once
  }
}

// ----------------------------------------------------------------- notifications

type NotificationsModule = typeof import('expo-notifications');
let modulePromise: Promise<NotificationsModule | null> | null = null;

/**
 * expo-notifications is loaded only when first needed. Expo Go prints a warning about push
 * notifications when the package loads; loading it lazily keeps that out of everyday use. Local
 * notifications, which is all budget alerts use, work in Expo Go and in real builds.
 */
function loadNotifications(): Promise<NotificationsModule | null> {
  modulePromise ??= import('expo-notifications')
    .then(async (N) => {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync(CHANNEL, {
          name: 'Budget alerts',
          importance: N.AndroidImportance.DEFAULT,
        });
      }
      return N;
    })
    .catch(() => null);
  return modulePromise;
}

/** True if notifications are allowed. Asks the system once (on Android 13+) if nothing was decided yet. */
export async function ensureNotificationPermission(askIfNeeded: boolean): Promise<boolean> {
  const N = await loadNotifications();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!askIfNeeded || !current.canAskAgain) return false;
    const result = await N.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

/** Asks for permission only the first time an alert actually needs to be sent. */
export async function permissionForAlerts(): Promise<boolean> {
  let asked = false;
  try {
    asked = (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    // treat as not asked
  }
  if (!asked) {
    try {
      await AsyncStorage.setItem(ASKED_KEY, '1');
    } catch {
      // ignore
    }
  }
  return ensureNotificationPermission(!asked);
}

export async function sendNotification(title: string, body: string): Promise<void> {
  const N = await loadNotifications();
  if (!N) return;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
      trigger: null, // right now
    });
  } catch {
    // a failed notification must never affect the app
  }
}
