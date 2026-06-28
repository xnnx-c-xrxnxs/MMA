import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, CardHeader, CardTitle, CardContent } from '@mma/mobile-ui';

export default function DashboardScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.content}>
        <Text variant="heading">Dashboard</Text>
        <Text variant="muted" style={styles.subtitle}>Welcome to Mma Mobile</Text>

        <View style={styles.cards}>
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Text variant="muted">Manage user accounts and roles</Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Text variant="muted">View and manage product catalog</Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <Text variant="muted">Track and manage customer orders</Text>
            </CardContent>
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 24,
  },
  cards: {
    gap: 12,
  },
});
