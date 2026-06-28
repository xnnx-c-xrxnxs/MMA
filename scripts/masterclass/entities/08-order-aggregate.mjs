// Level 8 — full aggregate: items + payment + coupon, with cross-cutting invariants.
export default {
  id: '08-order-aggregate',
  level: 6,
  complexityLabel: 'L8 · Full Aggregate',
  domain: 'Sales',
  title: 'Order (full aggregate)',
  introShort: 'Items + payment + coupon, with cross-cutting invariants & two status fields.',
  intro: 'The full Order aggregate composes everything from levels 1–7: child collection, value object (Coupon), payment sub-entity, two orthogonal status fields, and several cross-invariants the entity enforces atomically (discount cannot make total negative, payment amount must match total, cannot apply coupon after confirmation).',
  specTitle: 'Sales · Order (full aggregate)',
  specBodyHtml: `
    <p>The full <strong>Order</strong> on top of the draft from #6.</p>
    <ul>
      <li>Has all draft behaviour (items, totals, no duplicates, DRAFT-only edits).</li>
      <li>Has an optional <em>Coupon</em> (Value Object): <code>FIXED</code> off X, or <code>PERCENT</code> off N% (5–50).</li>
      <li>A coupon can only be applied while <code>DRAFT</code>.</li>
      <li>The discounted total can never go below 0; if a coupon would over-discount, it caps at 0.</li>
      <li>An order has a separate <em>payment</em>: status <code>PENDING</code> | <code>SUCCEEDED</code> | <code>REFUNDED</code> | <code>FAILED</code>.</li>
      <li><em>addPayment()</em> requires the amount to equal the discounted total.</li>
      <li><em>confirm()</em> requires items, a successful or pending payment, and current status <code>DRAFT</code>. It transitions to <code>CONFIRMED</code>.</li>
      <li>A <code>CONFIRMED</code> order can be <em>cancelled</em>; its pending payment is auto-failed.</li>
      <li>A <code>DELIVERED</code> order can be <em>refunded</em>, which moves payment to <code>REFUNDED</code> and order to <code>REFUNDED</code>.</li>
    </ul>
  `,
  entityFilename: 'order.entity.ts (excerpt)',
  entityCode: `import { OrderStatus, OrderStatusEnum } from '../constants';
import { Coupon } from './coupon.value';
import { OrderItem } from './order-item.entity';
import { OrderPayment } from './order-payment.entity';
import {
  CannotModifyNonDraftOrderError, CannotApplyCouponError,
  CannotConfirmEmptyOrderError, PaymentRequiredForConfirmationError,
  PaymentAmountMismatchError, OrderAlreadyHasPaymentError,
  InvalidOrderStatusTransitionError, CannotCancelOrderError,
  CannotRefundOrderError, InvalidPaymentStateForConfirmationError,
} from '../exceptions';

export class Order {
  private constructor(
    private readonly orderId: string | null,
    private readonly customerId: string,
    private items: OrderItem[],
    private coupon: Coupon | null,
    private payment: OrderPayment | null,
    private orderStatus: OrderStatus,
    private totalAmount: number,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { customerId: string }): Order {
    if (!props.customerId.trim()) throw new CustomerIdRequiredError();
    const now = new Date().toISOString();
    return new Order(null, props.customerId, [], null, null, OrderStatusEnum.DRAFT, 0, now, now);
  }

  // ── Items (delegated to draft pattern from #6) ──────────────────────────
  addItem(item: OrderItem): void {
    if (this.orderStatus !== OrderStatusEnum.DRAFT) throw new CannotModifyNonDraftOrderError('add');
    if (this.items.some((i) => i.getProductId() === item.getProductId())) {
      throw new DuplicateOrderItemError(item.getProductId());
    }
    this.items.push(item);
    this.recalculateTotal();
    this.touch();
  }

  // ── Coupon ──────────────────────────────────────────────────────────────
  applyCoupon(coupon: Coupon): void {
    if (this.orderStatus !== OrderStatusEnum.DRAFT) throw new CannotApplyCouponError('order is not draft');
    if (coupon.isExpired()) throw new CannotApplyCouponError('coupon expired');
    this.coupon = coupon;
    this.recalculateTotal();
    this.touch();
  }

  removeCoupon(): void {
    if (this.orderStatus !== OrderStatusEnum.DRAFT) throw new CannotApplyCouponError('order is not draft');
    if (!this.coupon) return;
    this.coupon = null;
    this.recalculateTotal();
    this.touch();
  }

  // ── Payment ─────────────────────────────────────────────────────────────
  addPayment(payment: OrderPayment): void {
    if (this.payment !== null) throw new OrderAlreadyHasPaymentError();
    if (payment.getAmount() !== this.totalAmount) throw new PaymentAmountMismatchError();
    this.payment = payment;
    this.touch();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  confirm(): void {
    if (this.orderStatus !== OrderStatusEnum.DRAFT) {
      throw new InvalidOrderStatusTransitionError('confirm', 'draft');
    }
    if (this.items.length === 0) throw new CannotConfirmEmptyOrderError();
    if (!this.payment) throw new PaymentRequiredForConfirmationError();
    if (!this.payment.isSuccessful() && !this.payment.isPending()) {
      throw new InvalidPaymentStateForConfirmationError();
    }
    this.orderStatus = OrderStatusEnum.CONFIRMED;
    this.touch();
  }

  cancel(): void {
    if (this.orderStatus === OrderStatusEnum.DELIVERED || this.orderStatus === OrderStatusEnum.REFUNDED) {
      throw new CannotCancelOrderError();
    }
    this.orderStatus = OrderStatusEnum.CANCELLED;
    if (this.payment?.isPending()) this.payment.fail();   // cascade
    this.touch();
  }

  refund(): void {
    if (this.orderStatus !== OrderStatusEnum.DELIVERED) {
      throw new CannotRefundOrderError('can only refund delivered orders');
    }
    if (!this.payment?.isSuccessful()) throw new CannotRefundOrderError('no successful payment');
    this.payment.refund();
    this.orderStatus = OrderStatusEnum.REFUNDED;
    this.touch();
  }

  /** Cross-invariant: total = items_total - coupon_discount, floored at 0. */
  private recalculateTotal(): void {
    const itemsTotal = this.items.reduce((s, i) => s + i.getSubtotal(), 0);
    const discount   = this.coupon ? this.coupon.discountFor(itemsTotal) : 0;
    this.totalAmount = Math.max(0, itemsTotal - discount);
  }
  private touch(): void { this.updatedAt = new Date().toISOString(); }
}

// ── coupon.value.ts ─────────────────────────────────────────────────────
export class Coupon {
  private constructor(
    public readonly code: string,
    public readonly kind: 'FIXED' | 'PERCENT',
    public readonly value: number,
    public readonly expiresAt: string
  ) {}

  static fixed(code: string, amount: number, expiresAt: string): Coupon {
    if (amount <= 0) throw new InvalidCouponError();
    return new Coupon(code, 'FIXED', amount, expiresAt);
  }
  static percent(code: string, percent: number, expiresAt: string): Coupon {
    if (percent < 5 || percent > 50) throw new InvalidCouponError();
    return new Coupon(code, 'PERCENT', percent, expiresAt);
  }

  isExpired(): boolean { return new Date(this.expiresAt).getTime() < Date.now(); }

  /** Pure function — same inputs always yield the same discount. */
  discountFor(itemsTotal: number): number {
    return this.kind === 'FIXED' ? this.value : itemsTotal * (this.value / 100);
  }
}`,
  concepts: [
    'Composition: aggregate + child + value object',
    'Two orthogonal status fields (order + payment)',
    'Cross-invariant: discount cannot make total negative',
    'Cascade side-effect: cancel order ⇒ fail pending payment',
    'Pure functions on Value Objects (discountFor)',
  ],
  exceptionsFilename: 'order-exceptions.ts (excerpt)',
  exceptionsCode: `export class CannotApplyCouponError extends Error {
  constructor(reason: string) {
    super(\`Cannot apply coupon: \${reason}\`);
    this.name = 'CannotApplyCouponError';
  }
}
export class PaymentAmountMismatchError extends Error {
  constructor() {
    super('Payment amount does not match order total');
    this.name = 'PaymentAmountMismatchError';
  }
}
export class CannotConfirmEmptyOrderError extends Error {
  constructor() {
    super('Cannot confirm an order with no items');
    this.name = 'CannotConfirmEmptyOrderError';
  }
}
export class CannotCancelOrderError extends Error {
  constructor() {
    super('Cannot cancel a delivered or refunded order');
    this.name = 'CannotCancelOrderError';
  }
}
export class CannotRefundOrderError extends Error {
  constructor(reason: string) {
    super(\`Cannot refund: \${reason}\`);
    this.name = 'CannotRefundOrderError';
  }
}
export class InvalidCouponError extends Error {
  constructor() { super('Invalid coupon configuration'); this.name = 'InvalidCouponError'; }
}`,
  pitfalls: [
    'Don\'t let the application service compute the total — that\'s how discounts get applied twice.',
    'Don\'t expose <code>setOrderStatus(status)</code> — every transition has its own method with its own guard.',
    'Don\'t forget the cascade in <code>cancel()</code> — a cancelled order with a still-pending payment is a money-loss bug.',
    'Don\'t reach into <code>order.payment</code> from outside to mutate it — the aggregate root mediates all changes.',
  ],
};
