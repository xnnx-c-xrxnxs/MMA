import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { Response } from 'express';

const logger = createLogger('file-api-service');

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

    // 2. Unexpected error fallback
    if (exception instanceof Error) {
      const errorName = exception.constructor.name;
      const errorMessage = exception.message;
      logger.error(`Unexpected error (${errorName}): ${errorMessage}`, {}, exception);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: errorName,
        message: errorMessage,
      });
      return;
    }

    // 3. Non-Error fallback
    logger.error('Unexpected non-Error thrown', { raw: String(exception) });
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'UnknownError',
      message: 'An unexpected error occurred',
    });
  }
}
