/**
 * Thrown when attempting to confirm an order that has items with price drift.
 * Price drift occurs when the latest known price of a product differs from
 * the snapshot price captured at order creation time.
 */
export class PriceDriftDetectedError extends Error {
  constructor() {
    super('Cannot confirm order: one or more items have a price drift. Review item prices before confirming.');
    this.name = 'PriceDriftDetectedError';
  }
}
