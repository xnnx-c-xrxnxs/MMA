import { z } from 'zod';
import {
  PRODUCT_STATUSES,
  ProductStatusEnum,
  type ProductStatus,
  CATEGORY_STATUSES,
  CategoryStatusEnum,
  type CategoryStatus,
} from '@old-st/product-domain';

// ============================================
// Re-exports from domain
// ============================================
export { PRODUCT_STATUSES, ProductStatusEnum };
export type { ProductStatus };
export { CATEGORY_STATUSES, CategoryStatusEnum };
export type { CategoryStatus };

// Zod schema for product status
export const productStatusSchema = z.enum(PRODUCT_STATUSES);

// Zod schema for category status
export const categoryStatusSchema = z.enum(CATEGORY_STATUSES);

// ============================================
// Product Schemas
// ============================================

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  categoryId: z.string().min(1),
  price: z.number().positive(),
  inventory: z.number().int().min(0).default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const productResponseSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categoryId: z.string(),
  price: z.number(),
  inventory: z.number(),
  status: productStatusSchema,
  dateCreated: z.string(),
  updatedAt: z.string(),
});

export type ProductResponse = z.infer<typeof productResponseSchema>;

export const updateProductDetailsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  categoryId: z.string().min(1).optional(),
});

export type UpdateProductDetailsInput = z.infer<typeof updateProductDetailsSchema>;

export const updateProductPriceSchema = z.object({
  price: z.number().positive(),
});

export type UpdateProductPriceInput = z.infer<typeof updateProductPriceSchema>;

export const updateProductInventorySchema = z.object({
  inventory: z.number().int().min(0),
});

export type UpdateProductInventoryInput = z.infer<typeof updateProductInventorySchema>;

export const getProductByIdSchema = z.object({
  productId: z.string(),
});

export type GetProductByIdInput = z.infer<typeof getProductByIdSchema>;

// ============================================
// Product List Schemas
// ============================================

export const listProductsByStatusSchema = z.object({
  status: productStatusSchema,
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export type ListProductsByStatusInput = z.infer<typeof listProductsByStatusSchema>;

export const listProductsByCategorySchema = z.object({
  categoryId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export type ListProductsByCategoryInput = z.infer<typeof listProductsByCategorySchema>;

export const searchProductsByNameSchema = z.object({
  searchTerm: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export type SearchProductsByNameInput = z.infer<typeof searchProductsByNameSchema>;

export const checkProductsAvailabilitySchema = z.object({
  productIds: z.array(z.string()).min(1).max(50),
});

export type CheckProductsAvailabilityInput = z.infer<typeof checkProductsAvailabilitySchema>;

export const productAvailabilityResultSchema = z.object({
  productId: z.string(),
  available: z.boolean(),
  inventory: z.number(),
  status: productStatusSchema,
});

export type ProductAvailabilityResult = z.infer<typeof productAvailabilityResultSchema>;

// ============================================
// Category Schemas
// ============================================

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const categoryResponseSchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: categoryStatusSchema,
  dateCreated: z.string(),
  updatedAt: z.string(),
});

export type CategoryResponse = z.infer<typeof categoryResponseSchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const getCategoryByIdSchema = z.object({
  categoryId: z.string(),
});

export type GetCategoryByIdInput = z.infer<typeof getCategoryByIdSchema>;

export const listCategoriesByStatusSchema = z.object({
  status: categoryStatusSchema,
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export type ListCategoriesByStatusInput = z.infer<typeof listCategoriesByStatusSchema>;

export const listCategoriesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
});

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
