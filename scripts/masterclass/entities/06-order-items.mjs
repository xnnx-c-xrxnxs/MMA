// Level 6 — collection: aggregate root that owns child entities.
export default {
  id: '06-order-items',
  level: 5,
  complexityLabel: 'L6 · Collection',
  domain: 'Sales',
  title: 'Order (draft + items)',
  introShort: 'An aggregate root that owns a collection of child entities.',
  intro: 'A draft Order owns a list of OrderItems. The aggregate root is responsible for invariants that span the collection: items can only be modified while DRAFT, the same product cannot be added twice, and the total is always recomputed from items. Children are never modified directly from outside.',
  specTitle: 'Sales · Order (draft state)',
  specBodyHtml: `
    <p>A draft <strong>Order</strong> belongs to a customer and contains a list of items.</p>
    <ul>
      <li>An <em>OrderItem</em> has: <code>productId</code>, <code>productName</code>, <code>quantity</code> (&gt; 0), <code>unitPrice</code> (≥ 0).</li>
      <li>Items can only be added, removed, or re-quantified while the order is in <code>DRAFT</code>.</li>
      <li>The same <em>productId</em> cannot appear twice — adding a duplicate is rejected.</li>
      <li>The order's <em>total</em> is always the sum of <code>quantity × unitPrice</code> across items. It is recomputed by the entity, never set from outside.</li>
      <li>An empty draft is allowed; only confirming an empty order is rejected (covered in #8).</li>
    </ul>
  `,
  entityFilename: 'order.entity.ts',
  entityCode: `import { OrderStatus, OrderStatusEnum } from '../constants';
import {
  CustomerIdRequiredError, CannotModifyNonDraftOrderError,
  OrderItemNotFoundError, DuplicateOrderItemError,
} from '../exceptions';
import { OrderItem } from './order-item.entity';

/** Aggregate root. Owns its OrderItems. */
export class Order {
  private constructor(
    private readonly orderId: string | null,
    private readonly customerId: string,
    private items: OrderItem[],
    private orderStatus: OrderStatus,
    private totalAmount: number,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { customerId: string }): Order {
    if (!props.customerId.trim()) throw new CustomerIdRequiredError();

    const now = new Date().toISOString();
    return new Order(null, props.customerId, [], OrderStatusEnum.DRAFT, 0, now, now);
  }

  // ── Collection mutators ─────────────────────────────────────────────────

  addItem(item: OrderItem): void {
    this.guardDraft('add');
    if (this.items.some((i) => i.getProductId() === item.getProductId())) {
      throw new DuplicateOrderItemError(item.getProductId());
    }
    this.items.push(item);
    this.recalculateTotal();
    this.touch();
  }

  removeItem(itemId: string): void {
    this.guardDraft('remove');
    const before = this.items.length;
    this.items = this.items.filter((i) => i.getItemId() !== itemId);
    if (this.items.length === before) throw new OrderItemNotFoundError(itemId);
    this.recalculateTotal();
    this.touch();
  }

  updateItemQuantity(itemId: string, newQuantity: number): void {
    this.guardDraft('update');
    const item = this.items.find((i) => i.getItemId() === itemId);
    if (!item) throw new OrderItemNotFoundError(itemId);
    item.updateQuantity(newQuantity);   // child enforces "quantity > 0"
    this.recalculateTotal();
    this.touch();
  }

  private guardDraft(op: 'add' | 'remove' | 'update'): void {
    if (this.orderStatus !== OrderStatusEnum.DRAFT) {
      throw new CannotModifyNonDraftOrderError(op);
    }
  }

  /** Total is derived state — only the entity computes it. */
  private recalculateTotal(): void {
    this.totalAmount = this.items.reduce((sum, i) => sum + i.getSubtotal(), 0);
  }

  private touch(): void { this.updatedAt = new Date().toISOString(); }

  // Getters return defensive copies of mutable collections
  getItems(): readonly OrderItem[] { return [...this.items]; }
  getTotalAmount(): number { return this.totalAmount; }
  getOrderStatus(): OrderStatus { return this.orderStatus; }
  getCustomerId(): string { return this.customerId; }
}

// ── order-item.entity.ts (child) ─────────────────────────────────────────
export class OrderItem {
  private constructor(
    private readonly itemId: string | null,
    private readonly productId: string,
    private readonly productName: string,
    private quantity: number,
    private readonly unitPrice: number
  ) {}

  static create(props: {
    productId: string; productName: string; quantity: number; unitPrice: number;
  }): OrderItem {
    if (props.quantity <= 0) throw new InvalidQuantityError();
    if (props.unitPrice < 0) throw new InvalidPriceError();
    if (!props.productName.trim()) throw new ProductNameRequiredError();
    return new OrderItem(null, props.productId, props.productName.trim(), props.quantity, props.unitPrice);
  }

  updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) throw new InvalidQuantityError();
    this.quantity = newQuantity;
  }

  getSubtotal(): number { return this.quantity * this.unitPrice; }
  getItemId(): string | null { return this.itemId; }
  getProductId(): string { return this.productId; }
}`,
  concepts: [
    'Aggregate root owns its children',
    'Collection-level invariants (no duplicates, draft-only edits)',
    'Children mutated only via the root',
    'Derived state (total) recomputed inside the entity',
    'Defensive copies returned from collection getters',
  ],
  exceptionsFilename: 'order-exceptions.ts (excerpt)',
  exceptionsCode: `export class CannotModifyNonDraftOrderError extends Error {
  constructor(operation: string) {
    super(\`Cannot \${operation} item: order is not in DRAFT status\`);
    this.name = 'CannotModifyNonDraftOrderError';
  }
}
export class DuplicateOrderItemError extends Error {
  constructor(productId: string) {
    super(\`Product \${productId} is already in the order\`);
    this.name = 'DuplicateOrderItemError';
  }
}
export class OrderItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(\`Order item \${itemId} not found\`);
    this.name = 'OrderItemNotFoundError';
  }
}
export class InvalidQuantityError extends Error {
  constructor() { super('Quantity must be greater than 0'); this.name = 'InvalidQuantityError'; }
}`,
  pitfalls: [
    'Never let outside code call <code>orderItem.updateQuantity()</code> directly — go through the root.',
    'Never expose <code>order.items</code> as a writable array — return a copy or <code>readonly</code>.',
    'Never store <code>totalAmount</code> as if it were independent — it is derived, recompute on every mutation.',
    'Don\'t accept "we\'ll deduplicate later in the application service" — the invariant lives <em>here</em>.',
  ],
};
