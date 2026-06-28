import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import { Response } from 'express';

const logger = createLogger('customer-api-service');

import {
  CustomerNotFoundError,
  CustomerAlreadyExistsError,
  CustomerAlreadyInactiveError,
  InvalidInputError,
  InvalidCustomerTierError,
  InvalidCustomerNameError,
} from '@mma/customer-domain';

type ErrorConstructor = new (...args: never[]) => Error;

const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  // 404 — Not Found
  [CustomerNotFoundError, HttpStatus.NOT_FOUND],

  // 409 — Conflict
  [CustomerAlreadyExistsError, HttpStatus.CONFLICT],
  [CustomerAlreadyInactiveError, HttpStatus.CONFLICT],

  // 400 — Bad Request
  [InvalidInputError, HttpStatus.BAD_REQUEST],
  [InvalidCustomerTierError, HttpStatus.BAD_REQUEST],
  [InvalidCustomerNameError, HttpStatus.BAD_REQUEST],
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
        logger.error(
          `[${exception.constructor.name}] ${status}`,
          {},
          exception,
        );
      } else {
        logger.warn(`[${exception.constructor.name}] ${status}`, {
          body: JSON.stringify(res),
        });
      }
      response.status(status).json(
        typeof res === 'string'
          ? {
              statusCode: status,
              error: exception.constructor.name,
              message: res,
            }
          : res,
      );
      return;
    }

    if (exception instanceof Error) {
      for (const [ErrorClass, statusCode] of DOMAIN_ERROR_MAP) {
        if (exception instanceof ErrorClass) {
          logger.warn(`[${exception.constructor.name}] ${exception.message}`, {
            statusCode,
          });
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

    logger.error(`[${errorName}] ${errorMessage}`, {}, exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: errorName,
      message: errorMessage,
    });
  }
}
