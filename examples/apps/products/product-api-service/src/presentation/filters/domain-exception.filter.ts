import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { Response } from 'express';

const logger = createLogger('product-api-service');
import {
  InvalidInputError,
  ProductNotFoundError,
  CategoryNotFoundError,
  CategoryNameAlreadyExistsError,
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductInventoryError,
  InvalidCategoryNameError,
  CannotActivateNonInactiveProductError,
  CannotDeactivateNonActiveProductError,
  CannotDiscontinueProductError,
  ProductAlreadyDeletedError,
  CannotUpdateDeletedProductError,
  CannotUpdateDiscontinuedProductError,
  CannotActivateNonInactiveCategoryError,
  CannotDeactivateNonActiveCategoryError,
  CannotDiscontinueCategoryError,
  CategoryAlreadyDeletedError,
  CannotUpdateDeletedCategoryError,
} from '@old-st/product-domain';

type ErrorConstructor = new (...args: never[]) => Error;

const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  // 404 — Not Found
  [ProductNotFoundError, 404],
  [CategoryNotFoundError, 404],

  // 400 — Bad Request
  [InvalidInputError, 400],
  [InvalidProductNameError, 400],
  [InvalidProductPriceError, 400],
  [InvalidProductInventoryError, 400],
  [InvalidCategoryNameError, 400],

  // 409 — Conflict (product)
  [CannotActivateNonInactiveProductError, 409],
  [CannotDeactivateNonActiveProductError, 409],
  [CannotDiscontinueProductError, 409],
  [ProductAlreadyDeletedError, 409],
  [CannotUpdateDeletedProductError, 409],
  [CannotUpdateDiscontinuedProductError, 409],

  // 409 — Conflict (category)
  [CategoryNameAlreadyExistsError, 409],
  [CannotActivateNonInactiveCategoryError, 409],
  [CannotDeactivateNonActiveCategoryError, 409],
  [CannotDiscontinueCategoryError, 409],
  [CategoryAlreadyDeletedError, 409],
  [CannotUpdateDeletedCategoryError, 409],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Check HttpException first — it extends Error, so order matters
    // Use getResponse() not .message to preserve Zod validation issues in BadRequestException
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
