'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
  toast,
} from '@old-st/ui';
import {
  formatProductStatus,
  useUpdateProductInventory,
  useUpdateProductPrice,
} from '@old-st/client-common';
import {
  updateProductInventorySchema,
  updateProductPriceSchema,
} from '@old-st/contracts/product';
import type {
  ProductResponse,
  UpdateProductInventoryInput,
  UpdateProductPriceInput,
} from '@old-st/contracts/product';
import { productStatusVariant } from '@/lib/status-variants';

export function ProductDetailsCard({ product }: { product: ProductResponse }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingInventory, setEditingInventory] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Details</span>
          <Badge
            data-testid="product-status-badge"
            variant={productStatusVariant(product.status)}
          >
            {formatProductStatus(product.status)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Row label="Name" value={product.name} />
        {product.description && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span className="text-right max-w-[60%]">
              {product.description}
            </span>
          </div>
        )}
        <Row label="Category" value={product.categoryId} />
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Price</span>
          {editingPrice ? (
            <PriceEditor
              product={product}
              onDone={() => setEditingPrice(false)}
            />
          ) : (
            <button
              type="button"
              className="cursor-pointer hover:underline"
              onClick={() => setEditingPrice(true)}
            >
              ${product.price.toFixed(2)}
            </button>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Inventory</span>
          {editingInventory ? (
            <InventoryEditor
              product={product}
              onDone={() => setEditingInventory(false)}
            />
          ) : (
            <button
              type="button"
              className="cursor-pointer hover:underline"
              onClick={() => setEditingInventory(true)}
            >
              {product.inventory}
            </button>
          )}
        </div>
        <Row
          label="Created"
          value={new Date(product.dateCreated).toLocaleString()}
        />
        <Row
          label="Updated"
          value={new Date(product.updatedAt).toLocaleString()}
        />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PriceEditor({
  product,
  onDone,
}: {
  product: ProductResponse;
  onDone: () => void;
}) {
  const updatePrice = useUpdateProductPrice();
  const form = useForm<UpdateProductPriceInput>({
    resolver: zodResolver(updateProductPriceSchema),
    defaultValues: { price: product.price },
  });

  const onSubmit = async (values: UpdateProductPriceInput) => {
    try {
      await updatePrice.mutateAsync({
        productId: product.productId,
        data: values,
      });
      toast.success('Price updated');
      onDone();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update price';
      toast.error(message);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex gap-2 items-start"
      >
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormControl>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-24"
                  value={field.value || ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </form>
    </Form>
  );
}

function InventoryEditor({
  product,
  onDone,
}: {
  product: ProductResponse;
  onDone: () => void;
}) {
  const updateInventory = useUpdateProductInventory();
  const form = useForm<UpdateProductInventoryInput>({
    resolver: zodResolver(updateProductInventorySchema),
    defaultValues: { inventory: product.inventory },
  });

  const onSubmit = async (values: UpdateProductInventoryInput) => {
    try {
      await updateInventory.mutateAsync({
        productId: product.productId,
        data: values,
      });
      toast.success('Inventory updated');
      onDone();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update inventory';
      toast.error(message);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex gap-2 items-start"
      >
        <FormField
          control={form.control}
          name="inventory"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className="w-24"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </form>
    </Form>
  );
}
