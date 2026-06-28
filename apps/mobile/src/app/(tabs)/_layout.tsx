import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Text } from '@mma/mobile-ui';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabIcon, focused ? styles.tabIconFocused : styles.tabIconInactive]}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
        tabBarActiveTintColor: '#1a1a2e',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} />,
        }}
      />
      {/*
        Add domain tab screens here, e.g.
          <Tabs.Screen name="widgets" options={{ title: 'Widgets', tabBarIcon: ... }} />
        See examples/apps/mobile/src/app/(tabs)/_layout.tsx for the full reference
        implementation (users, products, orders).
      */}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 10,
  },
  tabIconFocused: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  tabIconInactive: {
    color: '#94a3b8',
    fontWeight: '400',
  },
});
