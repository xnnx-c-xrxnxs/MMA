import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Text } from '@old-st/mobile-ui';

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
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused }) => <TabIcon label="📦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} />,
        }}
      />
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
