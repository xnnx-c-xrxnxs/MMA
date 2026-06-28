import { AddOrderPaymentUseCase } from './add-order-payment.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError, InvalidPaymentMethodError } from '../../exceptions';
import { OrderAlreadyHasPaymentError, PaymentAmountMismatchError } from '../../../domain/exceptions';

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

function makeDraftOrderWithTotal(total: number) {
  const item = OrderItem.reconstitute({
    itemId: 'item-1',
    productId: 'p1',
    productName: 'Widget',
    quantity: 1,
    price: total,
    latestKnownPrice: null,
    dateCreated: new Date().toISOString(),
  });
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [item],
    payment: null,
    orderStatus: OrderStatusEnum.DRAFT,
    totalAmount: total,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('AddOrderPaymentUseCase', () => {
  let useCase: AddOrderPaymentUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new AddOrderPaymentUseCase(mockRepo);
  });

  it('should add a payment to a draft order', async () => {
    const order = makeDraftOrderWithTotal(100);
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute({
      orderId: 'ord-1',
      paymentMethod: 'CREDIT_CARD',
      amount: 100,
    });

    expect(result.getPayment()).not.toBeNull();
    expect(result.getPayment()?.getAmount()).toBe(100);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(
      useCase.execute({ orderId: '', paymentMethod: 'CREDIT_CARD', amount: 100 }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw InvalidInputError when payment method is empty', async () => {
    await expect(
      useCase.execute({ orderId: 'ord-1', paymentMethod: '' as any, amount: 100 }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw InvalidPaymentMethodError for unknown payment method', async () => {
    await expect(
      useCase.execute({ orderId: 'ord-1', paymentMethod: 'BITCOIN' as any, amount: 100 }),
    ).rejects.toThrow(InvalidPaymentMethodError);
  });

  it('should throw OrderNotFoundError when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ orderId: 'missing', paymentMethod: 'CREDIT_CARD', amount: 100 }),
    ).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when amount does not match total', async () => {
    const order = makeDraftOrderWithTotal(100);
    mockRepo.findById.mockResolvedValue(order);

    await expect(
      useCase.execute({ orderId: 'ord-1', paymentMethod: 'CREDIT_CARD', amount: 50 }),
    ).rejects.toThrow(PaymentAmountMismatchError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
