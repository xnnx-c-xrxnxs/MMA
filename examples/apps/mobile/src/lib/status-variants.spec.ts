import {
  userStatusVariant,
  orderStatusVariant,
  paymentStatusVariant,
  productStatusVariant,
  categoryStatusVariant,
} from './status-variants';
import { UserStatusEnum } from '@old-st/contracts/user';
import { OrderStatusEnum, PaymentStatusEnum } from '@old-st/contracts/order';
import { ProductStatusEnum, CategoryStatusEnum } from '@old-st/contracts/product';

describe('userStatusVariant', () => {
  it.each([
    [UserStatusEnum.ACTIVE, 'success'],
    [UserStatusEnum.PENDING, 'warning'],
    [UserStatusEnum.INACTIVE, 'secondary'],
    [UserStatusEnum.DELETED, 'destructive'],
    ['UNKNOWN', 'outline'],
  ] as const)('maps %s → %s', (status, expected) => {
    expect(userStatusVariant(status)).toBe(expected);
  });
});

describe('orderStatusVariant', () => {
  it.each([
    [OrderStatusEnum.DRAFT, 'secondary'],
    [OrderStatusEnum.PENDING, 'warning'],
    [OrderStatusEnum.CONFIRMED, 'default'],
    [OrderStatusEnum.PROCESSING, 'default'],
    [OrderStatusEnum.SHIPPED, 'default'],
    [OrderStatusEnum.DELIVERED, 'success'],
    [OrderStatusEnum.CANCELLED, 'destructive'],
    [OrderStatusEnum.REFUNDED, 'destructive'],
    [OrderStatusEnum.VALIDATION_FAILED, 'destructive'],
    ['UNKNOWN', 'outline'],
  ] as const)('maps %s → %s', (status, expected) => {
    expect(orderStatusVariant(status)).toBe(expected);
  });
});

describe('paymentStatusVariant', () => {
  it.each([
    [PaymentStatusEnum.CAPTURED, 'success'],
    [PaymentStatusEnum.AUTHORIZED, 'default'],
    [PaymentStatusEnum.PENDING, 'warning'],
    [PaymentStatusEnum.FAILED, 'destructive'],
    [PaymentStatusEnum.CANCELLED, 'destructive'],
    [PaymentStatusEnum.REFUNDED, 'destructive'],
    ['UNKNOWN', 'outline'],
  ] as const)('maps %s → %s', (status, expected) => {
    expect(paymentStatusVariant(status)).toBe(expected);
  });
});

describe('productStatusVariant', () => {
  it.each([
    [ProductStatusEnum.ACTIVE, 'success'],
    [ProductStatusEnum.INACTIVE, 'secondary'],
    [ProductStatusEnum.DISCONTINUED, 'warning'],
    [ProductStatusEnum.DELETED, 'destructive'],
    ['UNKNOWN', 'outline'],
  ] as const)('maps %s → %s', (status, expected) => {
    expect(productStatusVariant(status)).toBe(expected);
  });
});

describe('categoryStatusVariant', () => {
  it.each([
    [CategoryStatusEnum.ACTIVE, 'success'],
    [CategoryStatusEnum.INACTIVE, 'secondary'],
    [CategoryStatusEnum.DISCONTINUED, 'warning'],
    [CategoryStatusEnum.DELETED, 'destructive'],
    ['UNKNOWN', 'outline'],
  ] as const)('maps %s → %s', (status, expected) => {
    expect(categoryStatusVariant(status)).toBe(expected);
  });
});
