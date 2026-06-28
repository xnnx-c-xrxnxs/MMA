export class InvalidCustomerTierError extends Error {
  constructor(tier: string) {
    super(`Invalid customer tier: ${tier}`);
    this.name = 'InvalidCustomerTierError';
  }
}
