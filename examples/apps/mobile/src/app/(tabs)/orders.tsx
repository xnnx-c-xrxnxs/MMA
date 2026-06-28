import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from '@old-st/mobile-ui';
import { useOrdersByStatus } from '@old-st/client-common';
import { ORDER_STATUSES } from '@old-st/contracts/order';
import { OrdersList } from '../../components/orders/orders-list';

const statuses = ['ALL', ...ORDER_STATUSES];

export default function OrdersScreen() {
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const queryStatus = selectedStatus === 'ALL' ? ORDER_STATUSES[0] : selectedStatus;

  const { data, isLoading } = useOrdersByStatus({ orderStatus: queryStatus });
  const orders = data?.data ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading">Orders</Text>
      </View>
      <View style={styles.filters}>
        {statuses.map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? 'default' : 'outline'}
            size="sm"
            onPress={() => setSelectedStatus(status)}
          >
            {status}
          </Button>
        ))}
      </View>
      <OrdersList orders={orders} isLoading={isLoading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
