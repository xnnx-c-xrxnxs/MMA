import { AddOrderItemUseCase, AddOrderItemInput } from './add-order-item.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';
import { CannotModifyNonDraftOrderError } from '../../../domain/exceptions';

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

function makeDraftOrder() {
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [],
    payment: null,
    orderStatus: OrderStatusEnum.DRAFT,
    totalAmount: 0,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('AddOrderItemUseCase', () => {
  let useCase: AddOrderItemUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new AddOrderItemUseCase(mockRepo);
  });

  it('should add an item to a draft order', async () => {
    const order = makeDraftOrder();
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const input: AddOrderItemInput = {
      orderId: 'ord-1',
      productId: 'p1',
      productName: 'Widget',
      quantity: 2,
      price: 10,
    };

    const result = await useCase.execute(input);

    expect(result.getItems()).toHaveLength(1);
    expect(result.getTotalAmount()).toBe(20);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(
      useCase.execute({ orderId: '', productId: 'p1', productName: 'W', quantity: 1, price: 5 }),
    ).rejects.toThrow(InvalidInputError);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('should throw OrderNotFoundError when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ orderId: 'missing', productId: 'p1', productName: 'W', quantity: 1, price: 5 }),
    ).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when order is not DRAFT', async () => {
    const confirmedOrder = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: null,
      orderStatus: OrderStatusEnum.CONFIRMED,
      totalAmount: 0,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(confirmedOrder);

    await expect(
      useCase.execute({ orderId: 'ord-1', productId: 'p1', productName: 'W', quantity: 1, price: 5 }),
    ).rejects.toThrow(CannotModifyNonDraftOrderError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
