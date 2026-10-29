import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'transactions', title: 'Activity', icon: 'swap-vertical-outline' },
  { name: 'budget', title: 'Budget', icon: 'wallet-outline' },
  { name: 'insights', title: 'Insights', icon: 'pie-chart-outline' },
];

/** The centre "+" is not a real tab: it opens the add-transaction screen. */
function AddButton() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      onPress={() => router.push('/transaction')}
      style={styles.addSlot}>
      <View style={[styles.addButton, { backgroundColor: theme.primary }]}>
        <Ionicons name="add" size={28} color={theme.onPrimary} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const screen = ({ name, title, icon }: (typeof TABS)[number]) => (
    <Tabs.Screen
      key={name}
      name={name}
      options={{
        title,
        tabBarIcon: ({ color }) => <Ionicons name={icon} size={22} color={color} />,
      }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontFamily: Type.bodyBold, fontSize: 10 },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 12 + insets.bottom,
          height: 64,
          borderRadius: 32,
          borderWidth: 1,
          borderTopWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          elevation: 0,
          paddingBottom: 0,
        },
      }}>
      {TABS.slice(0, 2).map(screen)}
      <Tabs.Screen name="add" options={{ title: 'Add', tabBarButton: () => <AddButton /> }} />
      {TABS.slice(2).map(screen)}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
