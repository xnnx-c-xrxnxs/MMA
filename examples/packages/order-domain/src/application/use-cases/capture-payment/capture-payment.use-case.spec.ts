import { CapturePaymentUseCase } from './capture-payment.use-case';
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

function makeOrderWithAuthorizedPayment() {
  const payment = OrderPayment.reconstitute({
    paymentId: 'pay-1',
    paymentMethod: 'CREDIT_CARD',
    amount: 100,
    paymentStatus: 'AUTHORIZED',
    transactionId: 'txn-1',
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [],
    payment,
    orderStatus: OrderStatusEnum.CONFIRMED,
    totalAmount: 100,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('CapturePaymentUseCase', () => {
  let useCase: CapturePaymentUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new CapturePaymentUseCase(mockRepo);
  });

  it('should capture an authorized payment', async () => {
    const order = makeOrderWithAuthorizedPayment();
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute('ord-1');

    expect(result.getPayment()?.getPaymentStatus()).toBe(PaymentStatusEnum.CAPTURED);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow(InvalidInputError);
  });

  it('should throw OrderNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when order has no payment', async () => {
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: null,
      orderStatus: OrderStatusEnum.CONFIRMED,
      totalAmount: 0,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(useCase.execute('ord-1')).rejects.toThrow(InvalidInputError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when payment is not AUTHORIZED', async () => {
    const pendingPayment = OrderPayment.reconstitute({
      paymentId: 'pay-1',
      paymentMethod: 'CREDIT_CARD',
      amount: 100,
      paymentStatus: 'PENDING',
      transactionId: null,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: pendingPayment,
      orderStatus: OrderStatusEnum.CONFIRMED,
      totalAmount: 100,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(useCase.execute('ord-1')).rejects.toThrow(InvalidPaymentStatusTransitionError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
