// Level 4 — full state machine with multiple terminal states & predicate guards.
export default {
  id: '04-product-lifecycle',
  level: 4,
  complexityLabel: 'L4 · State Machine',
  domain: 'Catalog',
  title: 'Product (with lifecycle)',
  introShort: 'A multi-state lifecycle: DRAFT → ACTIVE → DISCONTINUED, with guards.',
  intro: 'A real Product has a lifecycle. It starts as DRAFT (editable, hidden), can become ACTIVE (visible to customers), and can be DISCONTINUED (terminal — cannot be re-listed). Each transition has its own guard, and one transition (publish) requires a precondition (price > 0).',
  specTitle: 'Catalog · Product (with lifecycle)',
  specBodyHtml: `
    <p>A <strong>Product</strong> moves through a lifecycle that is enforced by the entity.</p>
    <ul>
      <li><em>DRAFT</em> — newly created. Editable. Not visible to customers.</li>
      <li><em>ACTIVE</em> — visible and purchasable. Edits to name and description are allowed; price changes require care.</li>
      <li><em>DISCONTINUED</em> — terminal. Cannot be re-published. Cannot be edited.</li>
    </ul>
    <p>Transitions:</p>
    <ul>
      <li><em>publish()</em>: <code>DRAFT → ACTIVE</code>, but only if <em>price &gt; 0</em>.</li>
      <li><em>discontinue()</em>: <code>ACTIVE → DISCONTINUED</code>. From DRAFT it's also allowed (just abandon the draft).</li>
      <li>You cannot publish a discontinued product. Ever.</li>
      <li><em>canPublish()</em> is exposed so callers can pre-flight without try/catch.</li>
    </ul>
  `,
  entityFilename: 'product.entity.ts',
  entityCode: `import { ProductStatus, ProductStatusEnum } from '../constants';
import {
  ProductNameRequiredError, InvalidProductPriceError,
  CannotPublishWithoutPriceError, CannotPublishDiscontinuedProductError,
  ProductAlreadyActiveError, ProductAlreadyDiscontinuedError,
  CannotEditDiscontinuedProductError,
} from '../exceptions';

export class Product {
  private constructor(
    private readonly productId: string | null,
    private name: string,
    private price: number,
    private description: string | null,
    private productStatus: ProductStatus,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { name: string; price: number; description?: string }): Product {
    if (props.name.trim().length === 0) throw new ProductNameRequiredError();
    if (!Number.isFinite(props.price) || props.price < 0) throw new InvalidProductPriceError();

    const now = new Date().toISOString();
    return new Product(
      null,
      props.name.trim(),
      props.price,
      props.description?.trim() ?? null,
      ProductStatusEnum.DRAFT,
      now, now
    );
  }

  // ── State transitions ────────────────────────────────────────────────────

  publish(): void {
    if (this.productStatus === ProductStatusEnum.DISCONTINUED) throw new CannotPublishDiscontinuedProductError();
    if (this.productStatus === ProductStatusEnum.ACTIVE) throw new ProductAlreadyActiveError();
    if (this.price <= 0) throw new CannotPublishWithoutPriceError();

    this.productStatus = ProductStatusEnum.ACTIVE;
    this.touch();
  }

  discontinue(): void {
    if (this.productStatus === ProductStatusEnum.DISCONTINUED) throw new ProductAlreadyDiscontinuedError();
    this.productStatus = ProductStatusEnum.DISCONTINUED;
    this.touch();
  }

  /** Pre-flight predicate so callers don't need try/catch. */
  canPublish(): boolean {
    return this.productStatus === ProductStatusEnum.DRAFT && this.price > 0;
  }

  // ── Edits ────────────────────────────────────────────────────────────────

  rename(newName: string): void {
    this.guardEditable();
    if (newName.trim().length === 0) throw new ProductNameRequiredError();
    this.name = newName.trim();
    this.touch();
  }

  changePrice(newPrice: number): void {
    this.guardEditable();
    if (!Number.isFinite(newPrice) || newPrice < 0) throw new InvalidProductPriceError();
    this.price = newPrice;
    this.touch();
  }

  updateDescription(description: string | null): void {
    this.guardEditable();
    this.description = description?.trim() ?? null;
    this.touch();
  }

  private guardEditable(): void {
    if (this.productStatus === ProductStatusEnum.DISCONTINUED) {
      throw new CannotEditDiscontinuedProductError();
    }
  }
  private touch(): void { this.updatedAt = new Date().toISOString(); }

  // Predicates + getters
  isDraft():        boolean { return this.productStatus === ProductStatusEnum.DRAFT; }
  isActive():       boolean { return this.productStatus === ProductStatusEnum.ACTIVE; }
  isDiscontinued(): boolean { return this.productStatus === ProductStatusEnum.DISCONTINUED; }

  getProductId(): string | null { return this.productId; }
  getName(): string { return this.name; }
  getPrice(): number { return this.price; }
  getProductStatus(): ProductStatus { return this.productStatus; }
}`,
  concepts: [
    'Multi-state lifecycle (DRAFT / ACTIVE / DISCONTINUED)',
    'Precondition guards (publish requires price > 0)',
    'Terminal states that reject all further transitions',
    'Public predicate (canPublish) for try/catch-free pre-flight',
    'guardEditable() — single check shared by every mutator',
  ],
  exceptionsFilename: 'product-exceptions.ts (excerpt)',
  exceptionsCode: `export class CannotPublishWithoutPriceError extends Error {
  constructor() { super('Cannot publish a product without a price'); this.name = 'CannotPublishWithoutPriceError'; }
}
export class CannotPublishDiscontinuedProductError extends Error {
  constructor() { super('Cannot publish a discontinued product'); this.name = 'CannotPublishDiscontinuedProductError'; }
}
export class ProductAlreadyActiveError extends Error {
  constructor() { super('Product is already active'); this.name = 'ProductAlreadyActiveError'; }
}
export class ProductAlreadyDiscontinuedError extends Error {
  constructor() { super('Product is already discontinued'); this.name = 'ProductAlreadyDiscontinuedError'; }
}
export class CannotEditDiscontinuedProductError extends Error {
  constructor() { super('Cannot edit a discontinued product'); this.name = 'CannotEditDiscontinuedProductError'; }
}`,
  pitfalls: [
    'Don\'t scatter <code>if (status !== DRAFT)</code> checks across mutators — extract <code>guardEditable()</code>.',
    'Don\'t expose a generic <code>setStatus(s)</code> method — that re-introduces the bug the state machine was meant to prevent.',
    'Don\'t treat DISCONTINUED as "soft delete" — it has different semantics (was-real, now-retired). Use a separate <code>DELETED</code> status if you need both.',
  ],
};
