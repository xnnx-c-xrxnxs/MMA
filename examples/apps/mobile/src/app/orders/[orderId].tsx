import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, Badge, Card, CardHeader, CardTitle, CardContent, Button, Separator } from '@old-st/mobile-ui';
import {
  useOrder,
  useConfirmOrder,
  useProcessOrder,
  useShipOrder,
  useDeliverOrder,
  useCancelOrder,
  formatOrderStatus,
  formatPaymentStatus,
} from '@old-st/client-common';
import { orderStatusVariant, paymentStatusVariant } from '../../lib/status-variants';
import { OrderStatusEnum } from '@old-st/contracts/order';

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrder(orderId);
  const confirmMutation = useConfirmOrder();
  const processMutation = useProcessOrder();
  const shipMutation = useShipOrder();
  const deliverMutation = useDeliverOrder();
  const cancelMutation = useCancelOrder();

  if (isLoading || !order) {
    return (
      <>
        <Stack.Screen options={{ title: 'Order Details', headerShown: true }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Order #${order.orderId.slice(0, 8)}`, headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card>
          <CardHeader>
            <View style={styles.titleRow}>
              <CardTitle>Order Details</CardTitle>
              <Badge variant={orderStatusVariant(order.orderStatus)}>{formatOrderStatus(order.orderStatus)}</Badge>
            </View>
          </CardHeader>
          <CardContent>
            <View style={styles.field}>
              <Text variant="caption">Customer ID</Text>
              <Text>{order.customerId}</Text>
            </View>
            <Separator style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.field}>
                <Text variant="caption">Total</Text>
                <Text variant="subheading">${(order.totalAmount / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.field}>
                <Text variant="caption">Items</Text>
                <Text variant="subheading">{order.items.length}</Text>
              </View>
            </View>
            <Separator style={styles.separator} />
            <View style={styles.field}>
              <Text variant="caption">Created</Text>
              <Text>{new Date(order.dateCreated).toLocaleDateString()}</Text>
            </View>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {order.items.map((item, idx) => (
              <View key={item.itemId ?? item.productId}>
                {idx > 0 && <Separator style={styles.separator} />}
                <View style={styles.row}>
                  <View style={styles.field}>
                    <Text variant="caption">Product</Text>
                    <Text>{item.productId.slice(0, 8)}...</Text>
                  </View>
                  <View style={styles.field}>
                    <Text variant="caption">Qty</Text>
                    <Text>{item.quantity}</Text>
                  </View>
                  <View style={styles.field}>
                    <Text variant="caption">Price</Text>
                    <Text>${(item.price / 100).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>

        {/* Payments */}
        {order.payment && (
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.row}>
                <View style={styles.field}>
                  <Text variant="caption">Method</Text>
                  <Text>{order.payment.paymentMethod}</Text>
                </View>
                <View style={styles.field}>
                  <Text variant="caption">Amount</Text>
                  <Text>${(order.payment.amount / 100).toFixed(2)}</Text>
                </View>
                <Badge variant={paymentStatusVariant(order.payment.paymentStatus)}>
                  {formatPaymentStatus(order.payment.paymentStatus)}
                </Badge>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.actions}>
              {order.orderStatus === OrderStatusEnum.PENDING && (
                <Button
                  variant="default"
                  onPress={() => confirmMutation.mutate(orderId)}
                  loading={confirmMutation.isPending}
                >
                  Confirm
                </Button>
              )}
              {order.orderStatus === OrderStatusEnum.CONFIRMED && (
                <Button
                  variant="default"
                  onPress={() => processMutation.mutate(orderId)}
                  loading={processMutation.isPending}
                >
                  Process
                </Button>
              )}
              {order.orderStatus === OrderStatusEnum.PROCESSING && (
                <Button
                  variant="default"
                  onPress={() => shipMutation.mutate(orderId)}
                  loading={shipMutation.isPending}
                >
                  Ship
                </Button>
              )}
              {order.orderStatus === OrderStatusEnum.SHIPPED && (
                <Button
                  variant="default"
                  onPress={() => deliverMutation.mutate(orderId)}
                  loading={deliverMutation.isPending}
                >
                  Mark Delivered
                </Button>
              )}
              {([OrderStatusEnum.DRAFT, OrderStatusEnum.PENDING, OrderStatusEnum.CONFIRMED] as string[]).includes(
                order.orderStatus,
              ) && (
                <Button
                  variant="destructive"
                  onPress={() => cancelMutation.mutate(orderId)}
                  loading={cancelMutation.isPending}
                >
                  Cancel Order
                </Button>
              )}
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  field: {
    gap: 2,
  },
  separator: {
    marginVertical: 12,
  },
  actions: {
    gap: 8,
  },
});
