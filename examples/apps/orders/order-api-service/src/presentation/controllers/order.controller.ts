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
import { z } from 'zod';
import {
  createOrderSchema,
  addOrderItemSchema,
  updateOrderItemQuantitySchema,
  removeOrderItemSchema,
  addOrderPaymentSchema,
  authorizePaymentSchema,
  orderStatusSchema,
  CreateOrderInput,
  AddOrderItemInput,
  UpdateOrderItemQuantityInput,
  RemoveOrderItemInput,
  AddOrderPaymentInput,
  ListOrdersByCustomerInput,
  ListOrdersByStatusInput,
} from '@old-st/contracts/order';
import { OrderApplicationService } from '../../application/services/order-application.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

// ── Local query schemas with z.coerce for HTTP query params ──────────────────

const listByCustomerQuerySchema = z.object({
  customerId: z.string(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

const listByStatusQuerySchema = z.object({
  orderStatus: orderStatusSchema,
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

// ── Shared Swagger response schema consts ────────────────────────────────────

const orderItemResponseSchema = {
  type: 'object' as const,
  properties: {
    itemId:      { type: 'string', example: 'item_01HX4ABCDE' },
    productId:   { type: 'string', example: 'prod_01HX4ABCDE' },
    productName: { type: 'string', example: 'Wireless Keyboard' },
    quantity:    { type: 'number', example: 2 },
    price:       { type: 'number', example: 49.99 },
  },
};

const orderPaymentResponseSchema = {
  type: 'object' as const,
  nullable: true,
  properties: {
    paymentId:     { type: 'string', example: 'pay_01HX4ABCDE' },
    paymentMethod: { type: 'string', enum: ['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY'], example: 'CREDIT_CARD' },
    paymentStatus: { type: 'string', enum: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED'], example: 'PENDING' },
    amount:        { type: 'number', example: 99.98 },
    transactionId: { type: 'string', nullable: true, example: null },
  },
};

const orderResponseSwaggerSchema = {
  type: 'object' as const,
  properties: {
    orderId:     { type: 'string', example: 'ord_01HX4ABCDE' },
    customerId:  { type: 'string', example: 'cust_01HX4ABCDE' },
    items:       { type: 'array', items: orderItemResponseSchema },
    payment:     orderPaymentResponseSchema,
    orderStatus: { type: 'string', enum: ['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'], example: 'DRAFT' },
    totalAmount: { type: 'number', example: 99.98 },
    dateCreated: { type: 'string', format: 'date-time' },
    updatedAt:   { type: 'string', format: 'date-time' },
  },
  required: ['orderId', 'customerId', 'items', 'orderStatus', 'totalAmount', 'updatedAt'],
};

const paginatedOrdersResponseSchema = {
  type: 'object' as const,
  properties: {
    data:       { type: 'array', items: orderResponseSwaggerSchema },
    total:      { type: 'number', example: 42 },
    page:       { type: 'number', example: 1 },
    limit:      { type: 'number', example: 20 },
    totalPages: { type: 'number', example: 3 },
  },
  required: ['data', 'total', 'page', 'limit', 'totalPages'],
};

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderApplicationService: OrderApplicationService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Static paths — must be declared before dynamic /:orderId routes
  // ──────────────────────────────────────────────────────────────────────────

  @Get('by-customer')
  @ApiOperation({
    summary: 'List orders by customer',
    description: 'Returns a paginated list of orders for a specific customer.',
  })
  @ApiQuery({ name: 'customerId', required: true, type: String, description: 'Customer ID to filter by' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (starts at 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of orders', schema: paginatedOrdersResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid customer ID' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listOrdersByCustomer(
    @Query(new ZodValidationPipe(listByCustomerQuerySchema))
    query: ListOrdersByCustomerInput,
  ) {
    return this.orderApplicationService.listOrdersByCustomer(query);
  }

  @Get('by-status')
  @ApiOperation({
    summary: 'List orders by status',
    description: 'Returns a paginated list of orders filtered by status.',
  })
  @ApiQuery({ name: 'orderStatus', required: true, enum: ['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'], description: 'Filter by order status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (starts at 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of orders', schema: paginatedOrdersResponseSchema })
  @ApiBadRequestResponse({ description: 'Invalid status value' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listOrdersByStatus(
    @Query(new ZodValidationPipe(listByStatusQuerySchema))
    query: ListOrdersByStatusInput,
  ) {
    return this.orderApplicationService.listOrdersByStatus(query);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dynamic /:orderId routes
  // ──────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new order',
    description: 'Creates a draft order with items for a customer.',
  })
  @ApiBody({
    description: 'Order creation payload',
    schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', example: 'cust_01HX4ABCDE' },
        items: {
          type: 'array',
          items: {
            type: 'object' as const,
            properties: {
              productId:   { type: 'string', example: 'prod_01HX4ABCDE' },
              productName: { type: 'string', example: 'Wireless Keyboard' },
              quantity:    { type: 'number', example: 2 },
              price:       { type: 'number', example: 49.99 },
            },
            required: ['productId', 'productName', 'quantity', 'price'],
          },
        },
      },
      required: ['customerId', 'items'],
    },
  })
  @ApiCreatedResponse({ description: 'Order created', schema: orderResponseSwaggerSchema })
  @ApiBadRequestResponse({ description: 'Validation error — invalid input fields' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  createOrder(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
  ) {
    return this.orderApplicationService.createOrder(body);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order found', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getOrderById(@Param('orderId') orderId: string) {
    return this.orderApplicationService.getOrderById(orderId);
  }

  @Delete(':orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete order', description: 'Permanently removes the order record.' })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiNoContentResponse({ description: 'Order deleted' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deleteOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.deleteOrder(orderId);
  }

  // ── Item management ───────────────────────────────────────────────────────

  @Post(':orderId/items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add item to order',
    description: 'Adds a new item to a draft order. Order must be in DRAFT status.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiBody({
    description: 'Item to add',
    schema: {
      type: 'object' as const,
      properties: {
        productId:   { type: 'string', example: 'prod_01HX4ABCDE' },
        productName: { type: 'string', example: 'Wireless Mouse' },
        quantity:    { type: 'number', example: 1 },
        price:       { type: 'number', example: 29.99 },
      },
      required: ['productId', 'productName', 'quantity', 'price'],
    },
  })
  @ApiOkResponse({ description: 'Item added to order', schema: orderResponseSwaggerSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not in DRAFT status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  addOrderItem(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(addOrderItemSchema)) body: AddOrderItemInput,
  ) {
    return this.orderApplicationService.addOrderItem(orderId, body);
  }

  @Delete(':orderId/items/:itemId')
  @ApiOperation({
    summary: 'Remove item from order',
    description: 'Removes an item from a draft order. Order must be in DRAFT status.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiParam({ name: 'itemId', description: 'Item ID to remove', example: 'item_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Item removed from order', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not in DRAFT status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  removeOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.orderApplicationService.removeOrderItem(orderId, itemId);
  }

  @Patch(':orderId/items')
  @ApiOperation({
    summary: 'Update item quantity',
    description: 'Updates the quantity of an item in a draft order.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiBody({
    description: 'Item quantity update payload',
    schema: {
      type: 'object' as const,
      properties: {
        itemId:   { type: 'string', example: 'item_01HX4ABCDE' },
        quantity: { type: 'number', example: 5 },
      },
      required: ['itemId', 'quantity'],
    },
  })
  @ApiOkResponse({ description: 'Item quantity updated', schema: orderResponseSwaggerSchema })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Order or item not found' })
  @ApiConflictResponse({ description: 'Order is not in DRAFT status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  updateOrderItemQuantity(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(updateOrderItemQuantitySchema)) body: UpdateOrderItemQuantityInput,
  ) {
    return this.orderApplicationService.updateOrderItemQuantity(orderId, body);
  }

  // ── Payment management ────────────────────────────────────────────────────

  @Post(':orderId/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add payment to order',
    description: 'Attaches a payment to an order. Amount must match order total.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiBody({
    description: 'Payment details',
    schema: {
      type: 'object' as const,
      properties: {
        paymentMethod: { type: 'string', enum: ['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY'], example: 'CREDIT_CARD' },
        amount:        { type: 'number', example: 99.98 },
      },
      required: ['paymentMethod', 'amount'],
    },
  })
  @ApiOkResponse({ description: 'Payment added to order', schema: orderResponseSwaggerSchema })
  @ApiBadRequestResponse({ description: 'Validation error or invalid payment method' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order already has a payment or amount mismatch' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  addOrderPayment(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(addOrderPaymentSchema)) body: AddOrderPaymentInput,
  ) {
    return this.orderApplicationService.addOrderPayment(orderId, body);
  }

  @Post(':orderId/payment/authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authorize payment',
    description: 'Authorizes a pending payment with a transaction ID.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiBody({
    description: 'Authorization details',
    schema: {
      type: 'object' as const,
      properties: {
        transactionId: { type: 'string', example: 'txn_ABC123' },
      },
      required: ['transactionId'],
    },
  })
  @ApiOkResponse({ description: 'Payment authorized', schema: orderResponseSwaggerSchema })
  @ApiBadRequestResponse({ description: 'Missing transaction ID or no payment on order' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Payment is not in PENDING status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  authorizePayment(
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(z.object({ transactionId: z.string() }))) body: { transactionId: string },
  ) {
    return this.orderApplicationService.authorizePayment(orderId, body.transactionId);
  }

  @Post(':orderId/payment/capture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Capture payment',
    description: 'Captures an authorized payment.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Payment captured', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Payment is not in AUTHORIZED status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  capturePayment(@Param('orderId') orderId: string) {
    return this.orderApplicationService.capturePayment(orderId);
  }

  // ── Order lifecycle actions ───────────────────────────────────────────────

  @Post(':orderId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm order',
    description: 'Transitions order from DRAFT to CONFIRMED. Requires at least one item and a valid payment.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order confirmed', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not in DRAFT status, has no items, or payment is missing/invalid' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  confirmOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.confirmOrder(orderId);
  }

  @Post(':orderId/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start processing order',
    description: 'Transitions order from CONFIRMED to PROCESSING.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order is now processing', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not in CONFIRMED status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  startProcessingOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.startProcessingOrder(orderId);
  }

  @Post(':orderId/ship')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ship order',
    description: 'Transitions order from PROCESSING to SHIPPED.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order shipped', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not in PROCESSING status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  shipOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.shipOrder(orderId);
  }

  @Post(':orderId/deliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deliver order',
    description: 'Transitions order from SHIPPED to DELIVERED.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order delivered', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not in SHIPPED status' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deliverOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.deliverOrder(orderId);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel order',
    description: 'Cancels an order. Cannot cancel delivered or refunded orders.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order cancelled', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is delivered or refunded and cannot be cancelled' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  cancelOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.cancelOrder(orderId);
  }

  @Post(':orderId/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund order',
    description: 'Refunds a delivered order. Requires a successful (captured) payment.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'ord_01HX4ABCDE' })
  @ApiOkResponse({ description: 'Order refunded', schema: orderResponseSwaggerSchema })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order is not delivered or has no successful payment' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  refundOrder(@Param('orderId') orderId: string) {
    return this.orderApplicationService.refundOrder(orderId);
  }
}
