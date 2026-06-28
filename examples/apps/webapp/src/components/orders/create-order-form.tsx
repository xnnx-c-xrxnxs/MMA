'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  toast,
} from '@old-st/ui';
import {
  useCreateOrder,
  useUsersByStatus,
  useProductsByStatus,
} from '@old-st/client-common';
import type { CreateOrderInput } from '@old-st/contracts/order';
import type { UserResponse } from '@old-st/contracts/user';
import type { ProductResponse } from '@old-st/contracts/product';

// UI-only schema — composes the canonical CreateOrderInput at submit time.
// Backend validation still runs against `createOrderSchema` server-side.
const orderFormSchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  productId: z.string().min(1, 'Select a product'),
  quantity: z.number().int().min(1).max(1000),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export function CreateOrderForm({ onClose }: { onClose: () => void }) {
  const createOrder = useCreateOrder();
  const { data: usersData, isLoading: usersLoading } = useUsersByStatus({
    userStatus: 'ACTIVE',
  });
  const { data: productsData, isLoading: productsLoading } =
    useProductsByStatus({ status: 'ACTIVE' });

  const users: UserResponse[] = usersData?.data ?? [];
  const products: ProductResponse[] = productsData?.data ?? [];

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: { customerId: '', productId: '', quantity: 1 },
  });

  const productId = form.watch('productId');
  const quantity = form.watch('quantity');
  const selectedProduct = products.find((p) => p.productId === productId);

  const onSubmit = async (values: OrderFormValues) => {
    const product = products.find((p) => p.productId === values.productId);
    if (!product) {
      toast.error('Selected product not found');
      return;
    }
    const input: CreateOrderInput = {
      customerId: values.customerId,
      items: [
        {
          productId: product.productId,
          productName: product.name,
          quantity: values.quantity,
          price: product.price,
        },
      ],
    };
    try {
      await createOrder.mutateAsync(input);
      toast.success('Order created');
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create order';
      toast.error(message);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Create Order</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            data-testid="create-order-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <FormControl>
                    <Select {...field} disabled={usersLoading}>
                      <option value="">
                        {usersLoading
                          ? 'Loading customers...'
                          : 'Select a customer'}
                      </option>
                      {users.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.firstName} {u.lastName} ({u.email})
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <FormControl>
                    <Select {...field} disabled={productsLoading}>
                      <option value="">
                        {productsLoading
                          ? 'Loading products...'
                          : 'Select a product'}
                      </option>
                      {products.map((p) => (
                        <option key={p.productId} value={p.productId}>
                          {p.name} — ${p.price.toFixed(2)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
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
            {selectedProduct && (
              <div className="flex items-end pb-2 text-sm text-muted-foreground">
                Unit price: ${selectedProduct.price.toFixed(2)} — Subtotal: $
                {(selectedProduct.price * quantity).toFixed(2)}
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating...' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
