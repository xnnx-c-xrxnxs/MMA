import { ConfirmOrderUseCase } from './confirm-order.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator, ValidatedCustomer } from '../../interfaces/customer-validator.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderPayment } from '../../../domain/entities/order-payment.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';
import {
  InvalidOrderStatusTransitionError,
  CannotConfirmEmptyOrderError,
  PaymentRequiredForConfirmationError,
} from '../../../domain/exceptions';

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

function makeConfirmableOrder() {
  const item = OrderItem.reconstitute({
    itemId: 'item-1',
    productId: 'p1',
    productName: 'Widget',
    quantity: 1,
    price: 50,
    latestKnownPrice: null,
    dateCreated: new Date().toISOString(),
  });
  const payment = OrderPayment.reconstitute({
    paymentId: 'pay-1',
    paymentMethod: 'CREDIT_CARD',
    amount: 50,
    paymentStatus: 'PENDING',
    transactionId: null,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [item],
    payment,
    orderStatus: OrderStatusEnum.PENDING,
    totalAmount: 50,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('ConfirmOrderUseCase', () => {
  let useCase: ConfirmOrderUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;
  let mockValidator: jest.Mocked<ICustomerValidator>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    mockValidator = {
      validate: jest.fn().mockResolvedValue({ customerId: 'cust-1', status: 'ACTIVE' } as ValidatedCustomer),
    } as unknown as jest.Mocked<ICustomerValidator>;
    useCase = new ConfirmOrderUseCase(mockRepo, mockValidator);
  });

  it('should confirm a PENDING order with items and payment', async () => {
    const order = makeConfirmableOrder();
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute('ord-1');

    expect(result.getOrderStatus()).toBe(OrderStatusEnum.CONFIRMED);
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

  it('should propagate domain error when order is not PENDING', async () => {
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

    await expect(useCase.execute('ord-1')).rejects.toThrow(InvalidOrderStatusTransitionError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when no items', async () => {
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 0,
        paymentStatus: 'PENDING',
        transactionId: null,
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      orderStatus: OrderStatusEnum.PENDING,
      totalAmount: 0,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(useCase.execute('ord-1')).rejects.toThrow(CannotConfirmEmptyOrderError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when no payment', async () => {
    const item = OrderItem.reconstitute({
      itemId: 'item-1',
      productId: 'p1',
      productName: 'Widget',
      quantity: 1,
      price: 50,
      latestKnownPrice: null,
      dateCreated: new Date().toISOString(),
    });
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [item],
      payment: null,
      orderStatus: OrderStatusEnum.PENDING,
      totalAmount: 50,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(useCase.execute('ord-1')).rejects.toThrow(PaymentRequiredForConfirmationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
