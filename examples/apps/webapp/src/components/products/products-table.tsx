'use client';

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@old-st/ui';
import { formatProductStatus } from '@old-st/client-common';
import { productStatusVariant } from '@/lib/status-variants';
import { ProductActions } from './product-actions';
import type { ProductResponse } from '@old-st/contracts/product';
import Link from 'next/link';

export function ProductsTable({ products }: { products: ProductResponse[] }) {
  return (
    <Table data-testid="products-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Inventory</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.productId} data-testid={`product-row-${product.productId}`}>
            <TableCell>
              <Link href={`/products/${product.productId}`} className="font-medium hover:underline">
                {product.name}
              </Link>
            </TableCell>
            <TableCell>${product.price.toFixed(2)}</TableCell>
            <TableCell>{product.inventory}</TableCell>
            <TableCell>
              <Badge variant={productStatusVariant(product.status)}>{formatProductStatus(product.status)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(product.dateCreated).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <ProductActions product={product} />
            </TableCell>
          </TableRow>
        ))}
        {products.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No products found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
