// @old-st/client-common-examples — example-domain React Query hooks + API clients
//
// This is the reference implementation that consumers of the template can
// copy from when adding their own domains. The base @old-st/client-common
// package only ships universal hooks (auth, file upload).

// API clients
export { userApiClient } from './infrastructure/api-clients/user-api.client';
export {
  productApiClient,
  categoryApiClient,
} from './infrastructure/api-clients/product-api.client';
export { orderApiClient } from './infrastructure/api-clients/order-api.client';

// User hooks
export {
  useUser,
  useUsersByStatus,
  useUsersByRoleAndStatus,
  useCreateUser,
  useUpdateUserProfile,
  useDeleteUser,
  useActivateUser,
  useDeactivateUser,
  useVerifyUserEmail,
  useUpdateUserRole,
} from './hooks/use-users';

// Product + category hooks
export {
  useProduct,
  useProductsByStatus,
  useProductsByCategory,
  useProductSearch,
  useCreateProduct,
  useUpdateProductDetails,
  useUpdateProductPrice,
  useUpdateProductInventory,
  useActivateProduct,
  useDeactivateProduct,
  useDiscontinueProduct,
  useDeleteProduct,
  useCategories,
  useCategory,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from './hooks/use-products';

// Order hooks
export {
  useOrder,
  useOrdersByStatus,
  useOrdersByCustomer,
  useCreateOrder,
  useDeleteOrder,
  useAddOrderItem,
  useRemoveOrderItem,
  useUpdateOrderItemQuantity,
  useAddOrderPayment,
  useConfirmOrder,
  useProcessOrder,
  useShipOrder,
  useDeliverOrder,
  useCancelOrder,
  useRefundOrder,
} from './hooks/use-orders';

// Cursor-paginated infinite scroll hooks (users + products)
export {
  useUsersByStatusInfinite,
  useUsersByRoleAndStatusInfinite,
  useProductsByStatusInfinite,
  useProductsByCategoryInfinite,
} from './hooks/use-infinite';

// Per-domain status formatters
export { formatUserStatus } from './lib/status-labels/user';
export { formatOrderStatus, formatPaymentStatus } from './lib/status-labels/order';
export { formatProductStatus, formatCategoryStatus } from './lib/status-labels/product';
