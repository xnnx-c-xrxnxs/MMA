import { CreateOrderUseCase, CreateOrderInput } from './create-order.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator, ValidatedCustomer } from '../../interfaces/customer-validator.interface';
import { IEventPublisher } from '@old-st/common';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError } from '../../exceptions';
import { CustomerIdRequiredError } from '../../../domain/exceptions';

function createMockRepository() {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findByStatus: jest.fn(),
    findByProductId: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IOrderRepository>;
}

function createMockEventPublisher() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<IEventPublisher<unknown>>;
}

describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;
  let mockValidator: jest.Mocked<ICustomerValidator>;
  let mockPublisher: jest.Mocked<IEventPublisher<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    mockValidator = {
      validate: jest.fn().mockResolvedValue({ customerId: 'cust-1', status: 'ACTIVE' } as ValidatedCustomer),
    } as unknown as jest.Mocked<ICustomerValidator>;
    mockPublisher = createMockEventPublisher();
    useCase = new CreateOrderUseCase(mockRepo, mockValidator, mockPublisher);
  });

  it('should create a draft order with items', async () => {
    const input: CreateOrderInput = {
      customerId: 'cust-1',
      items: [{ productId: 'p1', productName: 'Widget', quantity: 2, price: 10 }],
    };

    mockRepo.save.mockImplementation((order) => Promise.resolve(order));

    const result = await useCase.execute(input);

    expect(result).toBeInstanceOf(Order);
    expect(result.getCustomerId()).toBe('cust-1');
    expect(result.getItems()).toHaveLength(1);
    expect(result.getTotalAmount()).toBe(20);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should publish ORDER_CREATED event after saving', async () => {
    const input: CreateOrderInput = {
      customerId: 'cust-1',
      items: [{ productId: 'p1', productName: 'Widget', quantity: 2, price: 10 }],
    };

    // Simulate persistence assigning an orderId
    mockRepo.save.mockImplementation((order) => {
      const saved = Order.reconstitute({
        orderId: 'ord-saved-1',
        customerId: order.getCustomerId(),
        items: order.getItems(),
        payment: order.getPayment(),
        orderStatus: order.getOrderStatus(),
        totalAmount: order.getTotalAmount(),
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return Promise.resolve(saved);
    });

    await useCase.execute(input);

    expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ORDER_CREATED',
        orderId: 'ord-saved-1',
        customerId: 'cust-1',
      }),
    );
  });

  it('should throw InvalidInputError when customerId is empty', async () => {
    await expect(
      useCase.execute({ customerId: '', items: [{ productId: 'p1', productName: 'W', quantity: 1, price: 5 }] }),
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when items array is empty', async () => {
    await expect(
      useCase.execute({ customerId: 'cust-1', items: [] }),
    ).rejects.toThrow(InvalidInputError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain validation errors (e.g. invalid quantity)', async () => {
    await expect(
      useCase.execute({
        customerId: 'cust-1',
        items: [{ productId: 'p1', productName: 'W', quantity: -1, price: 5 }],
      }),
    ).rejects.toThrow();

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate repository errors', async () => {
    mockRepo.save.mockRejectedValue(new Error('DB error'));

    await expect(
      useCase.execute({
        customerId: 'cust-1',
        items: [{ productId: 'p1', productName: 'W', quantity: 1, price: 5 }],
      }),
    ).rejects.toThrow('DB error');
  });
});
