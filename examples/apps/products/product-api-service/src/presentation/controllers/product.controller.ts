import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  createProductSchema,
  updateProductDetailsSchema,
  updateProductPriceSchema,
  updateProductInventorySchema,
  listProductsByStatusSchema,
  listProductsByCategorySchema,
  searchProductsByNameSchema,
  checkProductsAvailabilitySchema,
  CreateProductInput,
  UpdateProductDetailsInput,
  UpdateProductPriceInput,
  UpdateProductInventoryInput,
  ListProductsByStatusInput,
  ListProductsByCategoryInput,
  SearchProductsByNameInput,
  CheckProductsAvailabilityInput,
} from '@old-st/contracts/product';
import { ProductApplicationService } from '../../application/services/product-application.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

// ── Shared response shape ─────────────────────────────────────────────────────
const productResponseSchema = {
  type: 'object' as const,
  properties: {
    productId:   { type: 'string', example: 'prod_01HX4ABCDE' },
    name:        { type: 'string', example: 'Wireless Headphones' },
    description: { type: 'string', example: 'Noise-cancelling over-ear headphones' },
    categoryId:  { type: 'string', example: 'cat_01HX4ABCDE' },
    price:       { type: 'number', example: 99.99 },
    inventory:   { type: 'number', example: 50 },
    status:      { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'DELETED'], example: 'ACTIVE' },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt:   { type: 'string', format: 'date-time' },
  },
  required: ['productId', 'name', 'categoryId', 'price', 'inventory', 'status', 'dateCreated', 'updatedAt'],
};

const paginatedProductsResponseSchema = {
  type: 'object' as const,
  properties: {
    data: { type: 'array', items: productResponseSchema },
    nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6InByb2QjMDEifQ==' },
    prevCursorPointer: { type: 'string', nullable: true, example: null },
  },
  required: ['data'],
};

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productApplicationService: ProductApplicationService,
  ) {}

  // ------------------------------------------------------------------
  // Static paths — must be declared before dynamic /:productId routes
  // ------------------------------------------------------------------

  @Get('by-status')
  @ApiOperation({
    summary: 'List products by status',
    description: 'Returns a cursor-paginated list of products filtered by status.',
  })
  @ApiQuery({ name: 'status', required: true, enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'DELETED'], description: 'Filter by product status' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
  @ApiOkResponse({ description: 'Paginated list of products', schema: paginatedProductsResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid status value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listProductsByStatus(
    @Query(new ZodValidationPipe(listProductsByStatusSchema))
    query: ListProductsByStatusInput,
  ) {
    return this.productApplicationService.listProductsByStatus(query);
  }

  @Get('by-category')
  @ApiOperation({
    summary: 'List products by category',
    description: 'Returns a cursor-paginated list of products belonging to a specific category.',
  })
  @ApiQuery({ name: 'categoryId', required: true, type: String, description: 'Category ID to filter by', example: 'cat_01HX4ABCDE' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
  @ApiOkResponse({ description: 'Paginated list of products in the category', schema: paginatedProductsResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid categoryId' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listProductsByCategory(
    @Query(new ZodValidationPipe(listProductsByCategorySchema))
    query: ListProductsByCategoryInput,
  ) {
    return this.productApplicationService.listProductsByCategory(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search products by name',
    description: 'Full-text search on product names. Returns a cursor-paginated result set.',
  })
  @ApiQuery({ name: 'searchTerm', required: true, type: String, description: 'Search keyword (1-100 characters)', example: 'headphones' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
  @ApiOkResponse({ description: 'Paginated search results', schema: paginatedProductsResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid or empty search term' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  searchProductsByName(
    @Query(new ZodValidationPipe(searchProductsByNameSchema))
    query: SearchProductsByNameInput,
  ) {
    return this.productApplicationService.searchProductsByName(query);
  }

  @Post('availability')
  @ApiOperation({
    summary: 'Check products availability',
    description: 'Checks inventory and status for a batch of product IDs (max 50).',
  })
  @ApiBody({
    description: 'List of product IDs to check',
    schema: {
      type: 'object',
      properties: {
        productIds: {
          type: 'array',
          items: { type: 'string', example: 'prod_01HX4ABCDE' },
          minItems: 1,
          maxItems: 50,
        },
      },
      required: ['productIds'],
    },
  })
  @ApiOkResponse({
    description: 'Availability result per product',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId:  { type: 'string', example: 'prod_01HX4ABCDE' },
          available:  { type: 'boolean', example: true },
          inventory:  { type: 'number', example: 10 },
          status:     { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'DELETED'] },
        },
        required: ['productId', 'available', 'inventory', 'status'],
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error — invalid or empty productIds array' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  checkProductsAvailability(
    @Body(new ZodValidationPipe(checkProductsAvailabilitySchema))
    body: CheckProductsAvailabilityInput,
  ) {
    return this.productApplicationService.checkProductsAvailability(body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Creates a product with INACTIVE status by default. categoryId must reference an existing category.',
  })
  @ApiBody({
    description: 'Product creation payload',
    schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', example: 'Wireless Headphones', description: '1-200 characters' },
        description: { type: 'string', example: 'Noise-cancelling over-ear headphones', description: 'Up to 2000 characters. Defaults to empty string.' },
        categoryId:  { type: 'string', example: 'cat_01HX4ABCDE' },
        price:       { type: 'number', example: 99.99, description: 'Must be positive' },
        inventory:   { type: 'number', example: 0, description: 'Non-negative integer. Defaults to 0.' },
      },
      required: ['name', 'categoryId', 'price'],
    },
  })
  @ApiCreatedResponse({ description: 'Product created successfully', schema: productResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error — invalid input fields' })
  @ApiConflictResponse({ description: 'A product with this name already exists in the category' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  createProduct(
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
  ) {
    return this.productApplicationService.createProduct(body);
  }

  // ------------------------------------------------------------------
  // Dynamic /:productId routes
  // ------------------------------------------------------------------

  @Get(':productId')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Product found', schema: productResponseSchema })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getProductById(@Param('productId') productId: string) {
    return this.productApplicationService.getProductById(productId);
  }

  @Patch(':productId/details')
  @ApiOperation({
    summary: 'Update product details',
    description: 'Partially updates name, description, or categoryId. All fields are optional.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiBody({
    description: 'Fields to update (all optional)',
    schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', example: 'Wireless Headphones Pro' },
        description: { type: 'string', example: 'Updated description' },
        categoryId:  { type: 'string', example: 'cat_01HX4ABCDE' },
      },
    },
  })
  @ApiOkResponse({ description: 'Product details updated', schema: productResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateProductDetails(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(updateProductDetailsSchema))
    body: UpdateProductDetailsInput,
  ) {
    return this.productApplicationService.updateProductDetails(productId, body);
  }

  @Patch(':productId/price')
  @ApiOperation({ summary: 'Update product price', description: 'Sets a new price for the product. Must be a positive number.' })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiBody({
    description: 'New product price',
    schema: {
      type: 'object',
      properties: {
        price: { type: 'number', example: 79.99, description: 'Must be positive' },
      },
      required: ['price'],
    },
  })
  @ApiOkResponse({ description: 'Price updated', schema: productResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid price value' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateProductPrice(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(updateProductPriceSchema))
    body: UpdateProductPriceInput,
  ) {
    return this.productApplicationService.updateProductPrice(productId, body);
  }

  @Patch(':productId/inventory')
  @ApiOperation({ summary: 'Update product inventory', description: 'Sets the absolute inventory count. Must be a non-negative integer.' })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiBody({
    description: 'New inventory count',
    schema: {
      type: 'object',
      properties: {
        inventory: { type: 'integer', example: 25, description: 'Non-negative integer' },
      },
      required: ['inventory'],
    },
  })
  @ApiOkResponse({ description: 'Inventory updated', schema: productResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid inventory value' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateProductInventory(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(updateProductInventorySchema))
    body: UpdateProductInventoryInput,
  ) {
    return this.productApplicationService.updateProductInventory(productId, body);
  }

  @Post(':productId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate product',
    description: 'Transitions the product to ACTIVE status. Only valid from INACTIVE.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Product activated', schema: productResponseSchema })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Product is already active or cannot transition from current status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  activateProduct(@Param('productId') productId: string) {
    return this.productApplicationService.activateProduct(productId);
  }

  @Post(':productId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate product',
    description: 'Transitions the product to INACTIVE status. Only valid from ACTIVE.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Product deactivated', schema: productResponseSchema })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Product is already inactive or cannot transition from current status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deactivateProduct(@Param('productId') productId: string) {
    return this.productApplicationService.deactivateProduct(productId);
  }

  @Post(':productId/discontinue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Discontinue product',
    description: 'Transitions the product to DISCONTINUED status. This is an irreversible action.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Product discontinued', schema: productResponseSchema })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Product is already discontinued or cannot transition from current status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  discontinueProduct(@Param('productId') productId: string) {
    return this.productApplicationService.discontinueProduct(productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product', description: 'Permanently removes the product record.' })
  @ApiParam({ name: 'productId', description: 'Product UUID', example: 'prod_01HX4ABCDE' })
  @ApiNoContentResponse({ description: 'Product deleted' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteProduct(@Param('productId') productId: string) {
    await this.productApplicationService.deleteProduct(productId);
  }
}
