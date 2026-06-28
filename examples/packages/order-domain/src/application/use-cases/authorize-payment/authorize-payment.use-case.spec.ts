import { AuthorizePaymentUseCase } from './authorize-payment.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderPayment } from '../../../domain/entities/order-payment.entity';
import { OrderStatusEnum, PaymentStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';
import { InvalidPaymentStatusTransitionError } from '../../../domain/exceptions';

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

function makeOrderWithPendingPayment() {
  const payment = OrderPayment.reconstitute({
    paymentId: 'pay-1',
    paymentMethod: 'CREDIT_CARD',
    amount: 100,
    paymentStatus: 'PENDING',
    transactionId: null,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [],
    payment,
    orderStatus: OrderStatusEnum.DRAFT,
    totalAmount: 100,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('AuthorizePaymentUseCase', () => {
  let useCase: AuthorizePaymentUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new AuthorizePaymentUseCase(mockRepo);
  });

  it('should authorize a pending payment', async () => {
    const order = makeOrderWithPendingPayment();
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute({ orderId: 'ord-1', transactionId: 'txn-abc' });

    expect(result.getPayment()?.getPaymentStatus()).toBe(PaymentStatusEnum.AUTHORIZED);
    expect(result.getPayment()?.getTransactionId()).toBe('txn-abc');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(
      useCase.execute({ orderId: '', transactionId: 'txn-1' }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw InvalidInputError when transactionId is empty', async () => {
    await expect(
      useCase.execute({ orderId: 'ord-1', transactionId: '' }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw OrderNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ orderId: 'missing', transactionId: 'txn-1' }),
    ).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when order has no payment', async () => {
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: null,
      orderStatus: OrderStatusEnum.DRAFT,
      totalAmount: 0,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(
      useCase.execute({ orderId: 'ord-1', transactionId: 'txn-1' }),
    ).rejects.toThrow(InvalidInputError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when payment is not PENDING', async () => {
    const authorizedPayment = OrderPayment.reconstitute({
      paymentId: 'pay-1',
      paymentMethod: 'CREDIT_CARD',
      amount: 100,
      paymentStatus: 'AUTHORIZED',
      transactionId: 'txn-old',
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: authorizedPayment,
      orderStatus: OrderStatusEnum.DRAFT,
      totalAmount: 100,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(
      useCase.execute({ orderId: 'ord-1', transactionId: 'txn-new' }),
    ).rejects.toThrow(InvalidPaymentStatusTransitionError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
