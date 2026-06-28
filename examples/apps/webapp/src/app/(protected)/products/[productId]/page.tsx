'use client';

import { use } from 'react';
import { Header } from '@/components/layout/header';
import { useProduct } from '@old-st/client-common';
import { ProductDetailsCard } from '@/components/products/product-details-card';
import { ProductActions } from '@/components/products/product-actions';

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const { data: product, isLoading, isError, error } = useProduct(productId);

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading...</p>;
  }
  if (isError) {
    return <p className="p-6 text-destructive">{error.message}</p>;
  }
  if (!product) {
    return <p className="p-6">Product not found</p>;
  }

  return (
    <>
      <Header title={product.name} />
      <div className="p-6 space-y-4 max-w-2xl">
        <ProductDetailsCard product={product} />
        <ProductActions product={product} variant="detail" />
      </div>
    </>
  );
}
