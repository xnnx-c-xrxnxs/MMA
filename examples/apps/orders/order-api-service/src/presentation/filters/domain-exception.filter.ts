import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { Response } from 'express';

const logger = createLogger('order-api-service');
import {
  // Domain exceptions
  InvalidOrderStatusTransitionError,
  CannotModifyNonDraftOrderError,
  CannotConfirmEmptyOrderError,
  CannotCancelOrderError,
  CannotRefundOrderError,
  OrderItemNotFoundError,
  OrderAlreadyHasPaymentError,
  PaymentAmountMismatchError,
  PaymentRequiredForConfirmationError,
  InvalidPaymentStateForConfirmationError,
  InvalidPaymentStatusTransitionError,
  InvalidQuantityError,
  InvalidPriceError,
  InvalidPaymentAmountError,
  ProductNameRequiredError,
  CustomerIdRequiredError,
  PriceDriftDetectedError,
  // Application exceptions
  OrderNotFoundError,
  InvalidInputError,
  InvalidOrderStatusError,
  InvalidPaymentMethodError,
  // ACL exceptions
  CustomerNotFoundError,
  CustomerInvalidStatusError,
  CustomerServiceUnavailableError,
} from '@old-st/order-domain';

type ErrorConstructor = new (...args: never[]) => Error;

const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  // 404 — Not Found
  [OrderNotFoundError, HttpStatus.NOT_FOUND],
  [OrderItemNotFoundError, HttpStatus.NOT_FOUND],

  // 409 — Conflict (state transition / invariant violations)
  [InvalidOrderStatusTransitionError, HttpStatus.CONFLICT],
  [CannotModifyNonDraftOrderError, HttpStatus.CONFLICT],
  [CannotConfirmEmptyOrderError, HttpStatus.CONFLICT],
  [CannotCancelOrderError, HttpStatus.CONFLICT],
  [CannotRefundOrderError, HttpStatus.CONFLICT],
  [OrderAlreadyHasPaymentError, HttpStatus.CONFLICT],
  [PaymentAmountMismatchError, HttpStatus.CONFLICT],
  [PaymentRequiredForConfirmationError, HttpStatus.CONFLICT],
  [InvalidPaymentStateForConfirmationError, HttpStatus.CONFLICT],
  [InvalidPaymentStatusTransitionError, HttpStatus.CONFLICT],
  [PriceDriftDetectedError, HttpStatus.CONFLICT],

  // 400 — Bad Request (input / validation errors)
  [InvalidInputError, HttpStatus.BAD_REQUEST],
  [InvalidOrderStatusError, HttpStatus.BAD_REQUEST],
  [InvalidPaymentMethodError, HttpStatus.BAD_REQUEST],
  [InvalidQuantityError, HttpStatus.BAD_REQUEST],
  [InvalidPriceError, HttpStatus.BAD_REQUEST],
  [InvalidPaymentAmountError, HttpStatus.BAD_REQUEST],
  [ProductNameRequiredError, HttpStatus.BAD_REQUEST],
  [CustomerIdRequiredError, HttpStatus.BAD_REQUEST],

  // ACL — Cross-service customer validation
  [CustomerNotFoundError, HttpStatus.NOT_FOUND],
  [CustomerInvalidStatusError, HttpStatus.CONFLICT],
  [CustomerServiceUnavailableError, HttpStatus.BAD_GATEWAY],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (status >= 500) {
        logger.error(`[${exception.constructor.name}] ${status}`, {}, exception);
      } else {
        logger.warn(`[${exception.constructor.name}] ${status}`, { body: JSON.stringify(res) });
      }
      response.status(status).json(
        typeof res === 'string'
          ? { statusCode: status, error: exception.constructor.name, message: res }
          : res,
      );
      return;
    }

    if (exception instanceof Error) {
      for (const [ErrorClass, statusCode] of DOMAIN_ERROR_MAP) {
        if (exception instanceof ErrorClass) {
          logger.warn(`[${exception.constructor.name}] ${exception.message}`, { statusCode });
          response.status(statusCode).json({
            statusCode,
            error: exception.constructor.name,
            message: exception.message,
          });
          return;
        }
      }
    }

    const errorName =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const errorStack =
      exception instanceof Error ? exception.stack : String(exception);

    logger.error(`[${errorName}] ${errorMessage}`, {}, exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: errorName,
      message: errorMessage,
    });
  }
}
