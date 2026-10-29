import { StyleSheet, View } from 'react-native';

import type { SafeToSpend } from '@/features/budget/safe-to-spend';
import { useTheme } from '@/hooks/use-theme';

/** Fill color for a budget status, from the theme (ok = accent, warning = amber, over = red). */
export function useStatusColor(status: SafeToSpend['status'] = 'ok') {
  const theme = useTheme();
  return status === 'over' ? theme.danger : status === 'warning' ? theme.warning : theme.primary;
}

export function ProgressBar({ ratio, status = 'ok' }: { ratio: number; status?: SafeToSpend['status'] }) {
  const theme = useTheme();
  const color = useStatusColor(status);
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
