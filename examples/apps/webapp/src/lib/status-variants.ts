import { UserStatusEnum } from '@old-st/contracts/user';
import { OrderStatusEnum, PaymentStatusEnum } from '@old-st/contracts/order';
import { ProductStatusEnum, CategoryStatusEnum } from '@old-st/contracts/product';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

export function userStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case UserStatusEnum.ACTIVE: return 'success';
    case UserStatusEnum.PENDING: return 'warning';
    case UserStatusEnum.INACTIVE: return 'secondary';
    case UserStatusEnum.DELETED: return 'destructive';
    default: return 'outline';
  }
}

export function orderStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case OrderStatusEnum.DRAFT: return 'secondary';
    case OrderStatusEnum.PENDING: return 'warning';
    case OrderStatusEnum.CONFIRMED:
    case OrderStatusEnum.PROCESSING:
    case OrderStatusEnum.SHIPPED: return 'default';
    case OrderStatusEnum.DELIVERED: return 'success';
    case OrderStatusEnum.CANCELLED:
    case OrderStatusEnum.REFUNDED:
    case OrderStatusEnum.VALIDATION_FAILED: return 'destructive';
    default: return 'outline';
  }
}

export function paymentStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case PaymentStatusEnum.CAPTURED: return 'success';
    case PaymentStatusEnum.AUTHORIZED: return 'default';
    case PaymentStatusEnum.PENDING: return 'warning';
    case PaymentStatusEnum.FAILED:
    case PaymentStatusEnum.CANCELLED:
    case PaymentStatusEnum.REFUNDED: return 'destructive';
    default: return 'outline';
  }
}

export function productStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case ProductStatusEnum.ACTIVE: return 'success';
    case ProductStatusEnum.INACTIVE: return 'secondary';
    case ProductStatusEnum.DISCONTINUED: return 'warning';
    case ProductStatusEnum.DELETED: return 'destructive';
    default: return 'outline';
  }
}

export function categoryStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case CategoryStatusEnum.ACTIVE: return 'success';
    case CategoryStatusEnum.INACTIVE: return 'secondary';
    case CategoryStatusEnum.DISCONTINUED: return 'warning';
    case CategoryStatusEnum.DELETED: return 'destructive';
    default: return 'outline';
  }
}
