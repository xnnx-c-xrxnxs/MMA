import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Badge, Card, CardContent, Separator } from '@old-st/mobile-ui';
import { formatOrderStatus } from '@old-st/client-common';
import { orderStatusVariant } from '../../lib/status-variants';
import type { OrderResponse } from '@old-st/contracts/order';

interface OrderListItemProps {
  order: OrderResponse;
}

function OrderListItem({ order }: OrderListItemProps) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/orders/${order.orderId}`)}>
      <Card style={styles.card}>
        <CardContent style={styles.cardContent}>
          <View style={styles.row}>
            <View style={styles.info}>
              <Text variant="subheading">Order #{order.orderId.slice(0, 8)}</Text>
              <Text variant="muted">Customer: {order.customerId.slice(0, 8)}...</Text>
            </View>
            <Badge variant={orderStatusVariant(order.orderStatus)}>{formatOrderStatus(order.orderStatus)}</Badge>
          </View>
          <Separator style={styles.separator} />
          <View style={styles.meta}>
            <Text variant="caption">Items: {order.items.length}</Text>
            <Text variant="caption">Total: ${(order.totalAmount / 100).toFixed(2)}</Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}

interface OrdersListProps {
  orders: OrderResponse[];
  isLoading: boolean;
  onLoadMore?: () => void;
}

export function OrdersList({ orders, isLoading, onLoadMore }: OrdersListProps) {
  if (isLoading && orders.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.orderId}
      renderItem={({ item }) => <OrderListItem order={item} />}
      contentContainerStyle={styles.list}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text variant="muted" style={styles.empty}>No orders found</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 8,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginRight: 8,
    gap: 2,
  },
  separator: {
    marginVertical: 8,
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  empty: {
    textAlign: 'center',
    padding: 32,
  },
});
