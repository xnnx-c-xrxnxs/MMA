import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { Response } from 'express';

const logger = createLogger('user-api-service');
import {
  UserNotFoundError,
  EmailAlreadyExistsError,
  InvalidEmailFormatError,
  InvalidNameError,
  InvalidUserRoleError,
  InvalidUserStatusError,
  InvalidInputError,
  EmailAlreadyVerifiedError,
  CannotActivateNonPendingUserError,
  CannotActivateUnverifiedEmailError,
  CannotDeactivateDeletedUserError,
  UserAlreadyInactiveError,
  UserAlreadyDeletedError,
  CannotUpdateDeletedUserError,
  CannotChangeRoleOfDeletedUserError,
  UserAlreadyHasRoleError,
} from '@old-st/user-domain';

type ErrorConstructor = new (...args: never[]) => Error;

const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  [UserNotFoundError, 404],
  [InvalidEmailFormatError, 400],
  [InvalidNameError, 400],
  [InvalidUserRoleError, 400],
  [InvalidUserStatusError, 400],
  [InvalidInputError, 400],
  [EmailAlreadyExistsError, 409],
  [EmailAlreadyVerifiedError, 409],
  [CannotActivateNonPendingUserError, 409],
  [CannotActivateUnverifiedEmailError, 409],
  [CannotDeactivateDeletedUserError, 409],
  [UserAlreadyInactiveError, 409],
  [UserAlreadyDeletedError, 409],
  [CannotUpdateDeletedUserError, 409],
  [CannotChangeRoleOfDeletedUserError, 409],
  [UserAlreadyHasRoleError, 409],
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
