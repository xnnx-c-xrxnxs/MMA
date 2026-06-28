'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@old-st/ui';
import type { OrderResponse } from '@old-st/contracts/order';

export function OrderItemsTable({ items }: { items: OrderResponse['items'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Items ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.itemId ?? item.productId}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>${item.price.toFixed(2)}</TableCell>
                <TableCell>
                  ${(item.quantity * item.price).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
