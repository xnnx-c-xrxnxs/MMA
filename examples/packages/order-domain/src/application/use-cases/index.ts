/**
 * Order Domain Use Cases
 * Export all use cases for easy imports
 */

// Order Management
export * from './create-order/create-order.use-case';
export * from './get-order-by-id/get-order-by-id.use-case';
export * from './delete-order/delete-order.use-case';

// Order Item Management
export * from './add-order-item/add-order-item.use-case';
export * from './remove-order-item/remove-order-item.use-case';
export * from './update-order-item-quantity/update-order-item-quantity.use-case';

// Order Status Management
export * from './confirm-order/confirm-order.use-case';
export * from './start-processing-order/start-processing-order.use-case';
export * from './ship-order/ship-order.use-case';
export * from './deliver-order/deliver-order.use-case';
export * from './cancel-order/cancel-order.use-case';
export * from './refund-order/refund-order.use-case';

// Order Listing
export * from './list-orders-by-customer/list-orders-by-customer.use-case';
export * from './list-orders-by-status/list-orders-by-status.use-case';

// Payment Management
export * from './add-order-payment/add-order-payment.use-case';
export * from './authorize-payment/authorize-payment.use-case';
export * from './capture-payment/capture-payment.use-case';

// Event-Driven Use Cases (consumed by order-event-handler-service)
export * from './cancel-draft-orders-by-product/cancel-draft-orders-by-product.use-case';
export * from './update-item-latest-price/update-item-latest-price.use-case';
export * from './approve-product-validation/approve-product-validation.use-case';
export * from './fail-order-validation/fail-order-validation.use-case';
