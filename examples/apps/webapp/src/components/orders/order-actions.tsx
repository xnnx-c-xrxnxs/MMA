'use client';

import { Button } from '@old-st/ui';
import {
  useConfirmOrder,
  useProcessOrder,
  useShipOrder,
  useDeliverOrder,
  useCancelOrder,
  useRefundOrder,
  useDeleteOrder,
} from '@old-st/client-common';
import { OrderStatusEnum } from '@old-st/contracts/order';
import type { OrderStatus } from '@old-st/contracts/order';

export function OrderActions({ orderId, orderStatus }: { orderId: string; orderStatus: OrderStatus }) {
  const confirmOrder = useConfirmOrder();
  const processOrder = useProcessOrder();
  const shipOrder = useShipOrder();
  const deliverOrder = useDeliverOrder();
  const cancelOrder = useCancelOrder();
  const refundOrder = useRefundOrder();
  const deleteOrder = useDeleteOrder();

  return (
    <div className="flex flex-wrap gap-2">
      {orderStatus === OrderStatusEnum.PENDING && (
        <Button variant="outline" onClick={() => confirmOrder.mutate(orderId)}>Confirm</Button>
      )}
      {orderStatus === OrderStatusEnum.CONFIRMED && (
        <Button variant="outline" onClick={() => processOrder.mutate(orderId)}>Process</Button>
      )}
      {orderStatus === OrderStatusEnum.PROCESSING && (
        <Button variant="outline" onClick={() => shipOrder.mutate(orderId)}>Ship</Button>
      )}
      {orderStatus === OrderStatusEnum.SHIPPED && (
        <Button variant="outline" onClick={() => deliverOrder.mutate(orderId)}>Deliver</Button>
      )}
      {orderStatus === OrderStatusEnum.DELIVERED && (
        <Button variant="outline" onClick={() => refundOrder.mutate(orderId)}>Refund</Button>
      )}
      {!([OrderStatusEnum.CANCELLED, OrderStatusEnum.REFUNDED, OrderStatusEnum.DELIVERED, OrderStatusEnum.VALIDATION_FAILED] as OrderStatus[]).includes(orderStatus) && (
        <Button variant="destructive" onClick={() => cancelOrder.mutate(orderId)}>Cancel</Button>
      )}
      {orderStatus === OrderStatusEnum.DRAFT && (
        <Button variant="destructive" onClick={() => deleteOrder.mutate(orderId)}>Delete</Button>
      )}
    </div>
  );
}
