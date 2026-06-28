import { createTree } from '@nx/devkit/testing';
import useCaseGenerator from './generator';

const seedDomain = (kebab: string) => {
  const tree = createTree();
  tree.write(`packages/${kebab}-domain/package.json`, '{}');
  tree.write(`packages/${kebab}-domain/src/index.ts`, '');
  return tree;
};

describe('use-case generator', () => {
  it('throws when target domain package is missing', async () => {
    const tree = createTree();
    await expect(
      useCaseGenerator(tree, { domain: 'shipping', verb: 'cancel', type: 'action' }),
    ).rejects.toThrow(/does not exist/);
  });

  it('throws on invalid domain names', async () => {
    const tree = createTree();
    await expect(
      useCaseGenerator(tree, { domain: 'Shipping', verb: 'cancel', type: 'action' }),
    ).rejects.toThrow();
  });

  it('creates a `create` use case + spec + barrel entry', async () => {
    const tree = seedDomain('shipping');
    await useCaseGenerator(tree, {
      domain: 'shipping',
      verb: 'create',
      entity: 'shipment',
      type: 'create',
    });
    expect(tree.exists('packages/shipping-domain/src/application/use-cases/create-shipment/create-shipment.use-case.ts')).toBe(true);
    expect(tree.exists('packages/shipping-domain/src/application/use-cases/create-shipment/create-shipment.use-case.spec.ts')).toBe(true);
    const useCase = tree.read('packages/shipping-domain/src/application/use-cases/create-shipment/create-shipment.use-case.ts', 'utf-8') ?? '';
    expect(useCase).toContain('export class CreateShipmentUseCase');
    expect(useCase).toContain('Shipment.create');
    const barrel = tree.read('packages/shipping-domain/src/application/use-cases/index.ts', 'utf-8') ?? '';
    expect(barrel).toContain("export * from './create-shipment/create-shipment.use-case';");
  });

  it('creates an `action` use case calling the entity method derived from verb', async () => {
    const tree = seedDomain('shipping');
    await useCaseGenerator(tree, {
      domain: 'shipping',
      verb: 'cancel',
      entity: 'shipment',
      type: 'action',
    });
    const useCase = tree.read('packages/shipping-domain/src/application/use-cases/cancel-shipment/cancel-shipment.use-case.ts', 'utf-8') ?? '';
    expect(useCase).toContain('shipment.cancel();');
    expect(useCase).toContain('class CancelShipmentUseCase');
  });

  it('creates a `list` use case with pluralized + filter directory naming', async () => {
    const tree = seedDomain('shipping');
    await useCaseGenerator(tree, {
      domain: 'shipping',
      verb: 'list',
      entity: 'shipment',
      type: 'list',
    });
    expect(tree.exists('packages/shipping-domain/src/application/use-cases/list-shipments-by-status/list-shipments-by-status.use-case.ts')).toBe(true);
    const useCase = tree.read('packages/shipping-domain/src/application/use-cases/list-shipments-by-status/list-shipments-by-status.use-case.ts', 'utf-8') ?? '';
    expect(useCase).toContain('class ListShipmentsByStatusUseCase');
    expect(useCase).toContain('listByStatus');
  });

  it('creates a `get-by-id` use case', async () => {
    const tree = seedDomain('shipping');
    await useCaseGenerator(tree, {
      domain: 'shipping',
      verb: 'get',
      entity: 'shipment',
      type: 'get-by-id',
    });
    const useCase = tree.read('packages/shipping-domain/src/application/use-cases/get-shipment/get-shipment.use-case.ts', 'utf-8') ?? '';
    expect(useCase).toContain('class GetShipmentUseCase');
    expect(useCase).toContain('findById');
    expect(useCase).toContain('ShipmentNotFoundError');
  });

  it('throws when the use case file already exists', async () => {
    const tree = seedDomain('shipping');
    await useCaseGenerator(tree, { domain: 'shipping', verb: 'cancel', entity: 'shipment', type: 'action' });
    await expect(
      useCaseGenerator(tree, { domain: 'shipping', verb: 'cancel', entity: 'shipment', type: 'action' }),
    ).rejects.toThrow(/already exists/);
  });

  it('uses domain name as entity when entity is omitted', async () => {
    const tree = seedDomain('payment');
    await useCaseGenerator(tree, { domain: 'payment', verb: 'refund', type: 'action' });
    expect(tree.exists('packages/payment-domain/src/application/use-cases/refund-payment/refund-payment.use-case.ts')).toBe(true);
  });

  it('handles multi-word kebab-case domains and entities', async () => {
    const tree = seedDomain('order-item');
    await useCaseGenerator(tree, { domain: 'order-item', verb: 'cancel', type: 'action' });
    const path = 'packages/order-item-domain/src/application/use-cases/cancel-order-item/cancel-order-item.use-case.ts';
    expect(tree.exists(path)).toBe(true);
    const content = tree.read(path, 'utf-8') ?? '';
    expect(content).toContain('class CancelOrderItemUseCase');
    expect(content).toContain('IOrderItemRepository');
  });
});
