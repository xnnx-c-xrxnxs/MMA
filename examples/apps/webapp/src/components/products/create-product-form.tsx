'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useCreateProduct } from '@old-st/client-common';
import {
  createProductSchema,
  type CreateProductInput,
  type CategoryResponse,
} from '@old-st/contracts/product';

export function CreateProductForm({
  categories,
  onClose,
}: {
  categories: CategoryResponse[];
  onClose: () => void;
}) {
  const createProduct = useCreateProduct();

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: categories[0]?.categoryId ?? '',
      price: 0,
      inventory: 0,
    },
  });

  const onSubmit = async (values: CreateProductInput) => {
    try {
      await createProduct.mutateAsync(values);
      toast.success('Product created');
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create product';
      toast.error(message);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Create Product</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            data-testid="create-product-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {categories.map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.name}
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
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
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
            <FormField
              control={form.control}
              name="inventory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
