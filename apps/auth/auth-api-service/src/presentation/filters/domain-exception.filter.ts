import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { Response } from 'express';

const logger = createLogger('auth-api-service');

type ErrorConstructor = new (...args: never[]) => Error;

// Cognito SDK errors are identified by name, not class
// Map known Cognito error names to HTTP status codes
const COGNITO_ERROR_MAP: Record<string, number> = {
  NotAuthorizedException: 401,
  UserNotFoundException: 404,
  UsernameExistsException: 409,
  CodeMismatchException: 400,
  ExpiredCodeException: 400,
  InvalidPasswordException: 400,
  InvalidParameterException: 400,
  LimitExceededException: 429,
  TooManyRequestsException: 429,
  UserNotConfirmedException: 403,
  PasswordResetRequiredException: 403,
};

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. HttpException (NestJS built-in — includes BadRequestException from Zod pipe)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'object'
          ? body
          : { statusCode: status, error: exception.name, message: body },
      );
      return;
    }

    // 2. Cognito SDK errors (identified by error name property)
    if (exception instanceof Error) {
      const cognitoStatus = COGNITO_ERROR_MAP[exception.name];
      if (cognitoStatus) {
        response.status(cognitoStatus).json({
          statusCode: cognitoStatus,
          error: exception.name,
          message: exception.message,
        });
        return;
      }

      // 3. Generic Error (e.g. from local auth provider)
      if (exception.message === 'Incorrect username or password.' ||
          exception.message === 'Invalid refresh token.' ||
          exception.message === 'User not found.') {
        const status = exception.message.includes('not found') ? 404 : 401;
        response.status(status).json({
          statusCode: status,
          error: exception.constructor.name,
          message: exception.message,
        });
        return;
      }
    }

    // 4. Unexpected error fallback
    const errorName = exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorMessage = exception instanceof Error ? exception.message : 'An unexpected error occurred';
    logger.error(`Unexpected error (${errorName}): ${errorMessage}`, {}, exception instanceof Error ? exception : undefined);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: errorName,
      message: errorMessage,
    });
  }
}
