import { apiRequest, apiRequestVoid } from './base-api.client';
import {
  productResponseSchema,
  categoryResponseSchema,
  productAvailabilityResultSchema,
  type CreateProductInput,
  type UpdateProductDetailsInput,
  type UpdateProductPriceInput,
  type UpdateProductInventoryInput,
  type ProductResponse,
  type CategoryResponse,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type ProductAvailabilityResult,
} from '@old-st/contracts/product';
import { type PaginatedResponse, paginatedResponseSchema } from '@old-st/contracts/common';
import { z } from 'zod';
import { getApiConfig } from '../config';

const paginatedProductsSchema = paginatedResponseSchema(productResponseSchema);
const paginatedCategoriesSchema = paginatedResponseSchema(categoryResponseSchema);
const availabilityArraySchema = z.array(productAvailabilityResultSchema);

const baseUrl = () => getApiConfig().productApiUrl;

export const productApiClient = {
  create(input: CreateProductInput): Promise<ProductResponse> {
    return apiRequest(baseUrl(), '/products', {
      method: 'POST',
      body: input,
      schema: productResponseSchema,
    });
  },

  getById(productId: string): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}`, {
      schema: productResponseSchema,
    });
  },

  listByStatus(params: {
    status: string;
    limit?: number;
    cursor?: string;
    direction?: 'next' | 'prev';
  }): Promise<PaginatedResponse<ProductResponse>> {
    return apiRequest(baseUrl(), '/products/by-status', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedProductsSchema,
    });
  },

  listByCategory(params: {
    categoryId: string;
    limit?: number;
    cursor?: string;
    direction?: 'next' | 'prev';
  }): Promise<PaginatedResponse<ProductResponse>> {
    return apiRequest(baseUrl(), '/products/by-category', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedProductsSchema,
    });
  },

  search(params: {
    searchTerm: string;
    limit?: number;
    cursor?: string;
    direction?: 'next' | 'prev';
  }): Promise<PaginatedResponse<ProductResponse>> {
    return apiRequest(baseUrl(), '/products/search', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedProductsSchema,
    });
  },

  checkAvailability(productIds: string[]): Promise<ProductAvailabilityResult[]> {
    return apiRequest(baseUrl(), '/products/availability', {
      method: 'POST',
      body: { productIds },
      schema: availabilityArraySchema,
    });
  },

  updateDetails(productId: string, input: UpdateProductDetailsInput): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}/details`, {
      method: 'PATCH',
      body: input,
      schema: productResponseSchema,
    });
  },

  updatePrice(productId: string, input: UpdateProductPriceInput): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}/price`, {
      method: 'PATCH',
      body: input,
      schema: productResponseSchema,
    });
  },

  updateInventory(productId: string, input: UpdateProductInventoryInput): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}/inventory`, {
      method: 'PATCH',
      body: input,
      schema: productResponseSchema,
    });
  },

  activate(productId: string): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}/activate`, {
      method: 'POST',
      schema: productResponseSchema,
    });
  },

  deactivate(productId: string): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}/deactivate`, {
      method: 'POST',
      schema: productResponseSchema,
    });
  },

  discontinue(productId: string): Promise<ProductResponse> {
    return apiRequest(baseUrl(), `/products/${encodeURIComponent(productId)}/discontinue`, {
      method: 'POST',
      schema: productResponseSchema,
    });
  },

  delete(productId: string): Promise<void> {
    return apiRequestVoid(baseUrl(), `/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    });
  },
};

export const categoryApiClient = {
  create(input: CreateCategoryInput): Promise<CategoryResponse> {
    return apiRequest(baseUrl(), '/categories', {
      method: 'POST',
      body: input,
      schema: categoryResponseSchema,
    });
  },

  getById(categoryId: string): Promise<CategoryResponse> {
    return apiRequest(baseUrl(), `/categories/${encodeURIComponent(categoryId)}`, {
      schema: categoryResponseSchema,
    });
  },

  list(params?: {
    limit?: number;
    cursor?: string;
    direction?: 'next' | 'prev';
  }): Promise<PaginatedResponse<CategoryResponse>> {
    return apiRequest(baseUrl(), '/categories', {
      params: params as Record<string, string | number | undefined>,
      schema: paginatedCategoriesSchema,
    });
  },

  update(categoryId: string, input: UpdateCategoryInput): Promise<CategoryResponse> {
    return apiRequest(baseUrl(), `/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      body: input,
      schema: categoryResponseSchema,
    });
  },

  delete(categoryId: string): Promise<void> {
    return apiRequestVoid(baseUrl(), `/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    });
  },
};
