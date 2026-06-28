'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@old-st/ui';
import {
  useDeleteProduct,
  useActivateProduct,
  useDeactivateProduct,
  useDiscontinueProduct,
} from '@old-st/client-common';
import { ProductStatusEnum } from '@old-st/contracts/product';
import type { ProductResponse } from '@old-st/contracts/product';

export interface ProductActionsProps {
  product: ProductResponse;
  /**
   * `list` (default) — compact ghost buttons for the table action column.
   * `detail` — full-width action card used on the product detail page.
   */
  variant?: 'list' | 'detail';
}

export function ProductActions({
  product,
  variant = 'list',
}: ProductActionsProps) {
  const deleteProduct = useDeleteProduct();
  const activateProduct = useActivateProduct();
  const deactivateProduct = useDeactivateProduct();
  const discontinueProduct = useDiscontinueProduct();

  const isDetail = variant === 'detail';
  const buttonSize = isDetail ? undefined : ('sm' as const);
  const buttonVariant = isDetail ? ('outline' as const) : ('ghost' as const);

  const buttons = (
    <>
      {product.status === ProductStatusEnum.INACTIVE && (
        <Button
          size={buttonSize}
          variant={buttonVariant}
          onClick={() => activateProduct.mutate(product.productId)}
        >
          Activate
        </Button>
      )}
      {product.status === ProductStatusEnum.ACTIVE && (
        <>
          <Button
            size={buttonSize}
            variant={buttonVariant}
            onClick={() => deactivateProduct.mutate(product.productId)}
          >
            Deactivate
          </Button>
          <Button
            size={buttonSize}
            variant={buttonVariant}
            onClick={() => discontinueProduct.mutate(product.productId)}
          >
            Discontinue
          </Button>
        </>
      )}
      {product.status !== ProductStatusEnum.DELETED && (
        <Button
          size={buttonSize}
          variant={isDetail ? 'destructive' : 'ghost'}
          className={isDetail ? undefined : 'text-destructive'}
          onClick={() => deleteProduct.mutate(product.productId)}
        >
          Delete
        </Button>
      )}
    </>
  );

  if (!isDetail) {
    return <div className="flex gap-1">{buttons}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">{buttons}</CardContent>
    </Card>
  );
}
