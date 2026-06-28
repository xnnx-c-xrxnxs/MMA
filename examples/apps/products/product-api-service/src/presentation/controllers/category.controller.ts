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
  createCategorySchema,
  updateCategorySchema,
  listCategoriesSchema,
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesInput,
} from '@old-st/contracts/product';
import { CategoryApplicationService } from '../../application/services/category-application.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

// ── Shared response shape ─────────────────────────────────────────────────────
const categoryResponseSchema = {
  type: 'object' as const,
  properties: {
    categoryId:  { type: 'string', example: 'cat_01HX4ABCDE' },
    name:        { type: 'string', example: 'Electronics' },
    description: { type: 'string', example: 'Electronic devices and accessories' },
    status:      { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'DELETED'], example: 'ACTIVE' },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt:   { type: 'string', format: 'date-time' },
  },
  required: ['categoryId', 'name', 'status', 'dateCreated', 'updatedAt'],
};

const paginatedCategoriesResponseSchema = {
  type: 'object' as const,
  properties: {
    data: { type: 'array', items: categoryResponseSchema },
    nextCursorPointer: { type: 'string', nullable: true, example: 'eyJwayI6ImNhdCMwMSJ9' },
    prevCursorPointer: { type: 'string', nullable: true, example: null },
  },
  required: ['data'],
};

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(
    private readonly categoryApplicationService: CategoryApplicationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all categories',
    description: 'Returns a cursor-paginated list of all categories. Use limit, cursor, and direction to navigate pages.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'prev'], description: 'Pagination direction', example: 'next' })
  @ApiOkResponse({ description: 'Paginated list of categories', schema: paginatedCategoriesResponseSchema })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listCategories(
    @Query(new ZodValidationPipe(listCategoriesSchema))
    query: ListCategoriesInput,
  ) {
    return this.categoryApplicationService.listCategories(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new category',
    description: 'Creates a category with ACTIVE status by default. Name must be unique.',
  })
  @ApiBody({
    description: 'Category creation payload',
    schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', example: 'Electronics', description: '1-200 characters' },
        description: { type: 'string', example: 'Electronic devices and accessories', description: 'Up to 2000 characters. Optional.' },
      },
      required: ['name'],
    },
  })
  @ApiCreatedResponse({ description: 'Category created successfully', schema: categoryResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error — invalid input fields' })
  @ApiConflictResponse({ description: 'A category with this name already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  createCategory(
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
  ) {
    return this.categoryApplicationService.createCategory(body);
  }

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID', example: 'cat_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Category found', schema: categoryResponseSchema })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getCategoryById(@Param('categoryId') categoryId: string) {
    return this.categoryApplicationService.getCategoryById(categoryId);
  }

  @Patch(':categoryId')
  @ApiOperation({
    summary: 'Update category',
    description: 'Updates the name and/or description of an existing category.',
  })
  @ApiParam({ name: 'categoryId', description: 'Category UUID', example: 'cat_01HX4ABCDE' })
  @ApiBody({
    description: 'Category update payload',
    schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', example: 'Electronics & Gadgets', description: '1-200 characters' },
        description: { type: 'string', example: 'Updated description', description: 'Up to 2000 characters. Optional.' },
      },
      required: ['name'],
    },
  })
  @ApiOkResponse({ description: 'Category updated', schema: categoryResponseSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'A category with this name already exists' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.categoryApplicationService.updateCategory(categoryId, body);
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category', description: 'Permanently removes the category record.' })
  @ApiParam({ name: 'categoryId', description: 'Category UUID', example: 'cat_01HX4ABCDE' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteCategory(@Param('categoryId') categoryId: string) {
    await this.categoryApplicationService.deleteCategory(categoryId);
  }
}
