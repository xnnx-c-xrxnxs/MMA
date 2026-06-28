import { OrderPayment } from './order-payment.entity';
import { PaymentStatusEnum } from '../constants';
import {
  InvalidPaymentAmountError,
  InvalidPaymentStatusTransitionError,
} from '../exceptions';

describe('OrderPayment Entity', () => {
  describe('create()', () => {
    it('should create a valid payment with PENDING status', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      expect(payment.getPaymentMethod()).toBe('CREDIT_CARD');
      expect(payment.getAmount()).toBe(100);
      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.PENDING);
      expect(payment.getTransactionId()).toBeNull();
      expect(payment.getPaymentId()).toBeNull();
      expect(payment.getDateCreated()).toBeDefined();
    });

    it('should throw InvalidPaymentAmountError for zero amount', () => {
      expect(() =>
        OrderPayment.create({ paymentMethod: 'CREDIT_CARD', amount: 0 }),
      ).toThrow(InvalidPaymentAmountError);
    });

    it('should throw InvalidPaymentAmountError for negative amount', () => {
      expect(() =>
        OrderPayment.create({ paymentMethod: 'CREDIT_CARD', amount: -50 }),
      ).toThrow(InvalidPaymentAmountError);
    });
  });

  describe('reconstitute()', () => {
    it('should restore entity without applying create() validators', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-123',
        paymentMethod: 'PAYPAL',
        amount: 200,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-abc',
        dateCreated: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      expect(payment.getPaymentId()).toBe('pay-123');
      expect(payment.getPaymentMethod()).toBe('PAYPAL');
      expect(payment.getAmount()).toBe(200);
      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.CAPTURED);
      expect(payment.getTransactionId()).toBe('txn-abc');
    });
  });

  describe('authorize()', () => {
    it('should authorize a PENDING payment', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      payment.authorize('txn-123');

      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.AUTHORIZED);
      expect(payment.getTransactionId()).toBe('txn-123');
    });

    it('should throw when payment is not PENDING', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => payment.authorize('txn-new')).toThrow(
        InvalidPaymentStatusTransitionError,
      );
    });
  });

  describe('capture()', () => {
    it('should capture an AUTHORIZED payment', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });
      payment.authorize('txn-123');

      payment.capture();

      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.CAPTURED);
    });

    it('should throw when payment is not AUTHORIZED', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      expect(() => payment.capture()).toThrow(InvalidPaymentStatusTransitionError);
    });
  });

  describe('fail()', () => {
    it('should fail a PENDING payment', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      payment.fail();

      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.FAILED);
    });

    it('should fail an AUTHORIZED payment', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });
      payment.authorize('txn-123');

      payment.fail();

      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.FAILED);
    });

    it('should throw when payment is CAPTURED', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => payment.fail()).toThrow(InvalidPaymentStatusTransitionError);
    });

    it('should throw when payment is REFUNDED', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'REFUNDED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(() => payment.fail()).toThrow(InvalidPaymentStatusTransitionError);
    });
  });

  describe('refund()', () => {
    it('should refund a CAPTURED payment', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      payment.refund();

      expect(payment.getPaymentStatus()).toBe(PaymentStatusEnum.REFUNDED);
    });

    it('should throw when payment is not CAPTURED', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      expect(() => payment.refund()).toThrow(InvalidPaymentStatusTransitionError);
    });
  });

  describe('isSuccessful()', () => {
    it('should return true when CAPTURED', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'CAPTURED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(payment.isSuccessful()).toBe(true);
    });

    it('should return false when not CAPTURED', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      expect(payment.isSuccessful()).toBe(false);
    });
  });

  describe('isPending()', () => {
    it('should return true when PENDING', () => {
      const payment = OrderPayment.create({
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
      });

      expect(payment.isPending()).toBe(true);
    });

    it('should return false when not PENDING', () => {
      const payment = OrderPayment.reconstitute({
        paymentId: 'pay-1',
        paymentMethod: 'CREDIT_CARD',
        amount: 100,
        paymentStatus: 'AUTHORIZED',
        transactionId: 'txn-1',
        dateCreated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(payment.isPending()).toBe(false);
    });
  });
});
