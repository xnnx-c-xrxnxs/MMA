'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApiClient, categoryApiClient } from '../infrastructure/api-clients/product-api.client';
import type {
  CreateProductInput,
  UpdateProductDetailsInput,
  UpdateProductPriceInput,
  UpdateProductInventoryInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@old-st/contracts/product';

const PRODUCTS_KEY = 'products';
const CATEGORIES_KEY = 'categories';

export function useProduct(productId: string) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, productId],
    queryFn: () => productApiClient.getById(productId),
    enabled: !!productId,
  });
}

export function useProductsByStatus(params: {
  status: string;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, 'by-status', params],
    queryFn: () => productApiClient.listByStatus(params),
  });
}

export function useProductsByCategory(params: {
  categoryId: string;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, 'by-category', params],
    queryFn: () => productApiClient.listByCategory(params),
    enabled: !!params.categoryId,
  });
}

export function useProductSearch(params: {
  searchTerm: string;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, 'search', params],
    queryFn: () => productApiClient.search(params),
    enabled: !!params.searchTerm,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => productApiClient.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
    },
  });
}

export function useUpdateProductDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: UpdateProductDetailsInput }) =>
      productApiClient.updateDetails(productId, data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, productId] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, 'by-status'] });
    },
  });
}

export function useUpdateProductPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: UpdateProductPriceInput }) =>
      productApiClient.updatePrice(productId, data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, productId] });
    },
  });
}

export function useUpdateProductInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: UpdateProductInventoryInput }) =>
      productApiClient.updateInventory(productId, data),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, productId] });
    },
  });
}

export function useActivateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productApiClient.activate(productId),
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, productId] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, 'by-status'] });
    },
  });
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productApiClient.deactivate(productId),
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, productId] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, 'by-status'] });
    },
  });
}

export function useDiscontinueProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productApiClient.discontinue(productId),
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, productId] });
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, 'by-status'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productApiClient.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
    },
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useCategories(params?: {
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}) {
  return useQuery({
    queryKey: [CATEGORIES_KEY, params],
    queryFn: () => categoryApiClient.list(params),
  });
}

export function useCategory(categoryId: string) {
  return useQuery({
    queryKey: [CATEGORIES_KEY, categoryId],
    queryFn: () => categoryApiClient.getById(categoryId),
    enabled: !!categoryId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => categoryApiClient.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
    },
  });
}

export function useUpdateCategory(categoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCategoryInput) =>
      categoryApiClient.update(categoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY, categoryId] });
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => categoryApiClient.delete(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
    },
  });
}
