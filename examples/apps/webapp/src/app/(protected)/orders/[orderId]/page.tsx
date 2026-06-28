'use client';

import { use } from 'react';
import { Header } from '@/components/layout/header';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@old-st/ui';
import {
  useOrder,
  formatOrderStatus,
  formatPaymentStatus,
} from '@old-st/client-common';
import { orderStatusVariant, paymentStatusVariant } from '@/lib/status-variants';
import { OrderActions } from '@/components/orders/order-actions';
import { OrderItemsTable } from '@/components/orders/order-items-table';

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const { data: order, isLoading, isError, error } = useOrder(orderId);

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading...</p>;
  }
  if (isError) {
    return <p className="p-6 text-destructive">{error.message}</p>;
  }
  if (!order) {
    return <p className="p-6">Order not found</p>;
  }

  return (
    <>
      <Header title={`Order ${order.orderId.slice(0, 8)}...`} />
      <div className="p-6 space-y-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order Info</span>
              <Badge
                data-testid="order-status-badge"
                variant={orderStatusVariant(order.orderStatus)}
              >
                {formatOrderStatus(order.orderStatus)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Order ID" value={order.orderId} mono />
            <Row label="Customer ID" value={order.customerId} mono />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
            <Row
              label="Created"
              value={new Date(order.dateCreated).toLocaleString()}
            />
            <Row
              label="Updated"
              value={new Date(order.updatedAt).toLocaleString()}
            />
          </CardContent>
        </Card>

        <OrderItemsTable items={order.items} />

        {order.payment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Payment</span>
                <Badge
                  variant={paymentStatusVariant(order.payment.paymentStatus)}
                >
                  {formatPaymentStatus(order.payment.paymentStatus)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Row label="Method" value={order.payment.paymentMethod} />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span>${order.payment.amount.toFixed(2)}</span>
              </div>
              {order.payment.transactionId && (
                <Row
                  label="Transaction ID"
                  value={order.payment.transactionId}
                  mono
                />
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderActions orderId={orderId} orderStatus={order.orderStatus} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono' : undefined}>{value}</span>
    </div>
  );
}
