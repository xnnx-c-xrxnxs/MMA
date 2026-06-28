'use client';

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@old-st/ui';
import { useDeleteOrder, formatOrderStatus } from '@old-st/client-common';
import { orderStatusVariant } from '@/lib/status-variants';
import { OrderStatusEnum } from '@old-st/contracts/order';
import type { OrderResponse } from '@old-st/contracts/order';
import Link from 'next/link';

export function OrdersTable({ orders }: { orders: OrderResponse[] }) {
  const deleteOrder = useDeleteOrder();

  return (
    <Table data-testid="orders-table">
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.orderId} data-testid={`order-row-${order.orderId}`}>
            <TableCell>
              <Link href={`/orders/${order.orderId}`} className="font-medium hover:underline">
                {order.orderId.slice(0, 8)}...
              </Link>
            </TableCell>
            <TableCell>{order.customerId.slice(0, 8)}...</TableCell>
            <TableCell>{order.items.length}</TableCell>
            <TableCell>${order.totalAmount.toFixed(2)}</TableCell>
            <TableCell>
              <Badge variant={orderStatusVariant(order.orderStatus)}>{formatOrderStatus(order.orderStatus)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(order.dateCreated).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              {order.orderStatus === OrderStatusEnum.DRAFT && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteOrder.mutate(order.orderId)}
                >
                  Delete
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {orders.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No orders found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
