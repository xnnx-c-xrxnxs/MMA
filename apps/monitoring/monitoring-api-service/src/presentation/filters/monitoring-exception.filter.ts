import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { Response } from 'express';

const logger = createLogger('monitoring-api-service');

@Catch()
export class MonitoringExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, error: exception.constructor.name, message: body }
          : body,
      );
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    const errorName = exception instanceof Error ? exception.constructor.name : 'UnknownError';

    logger.error(`[${errorName}] ${message}`, {}, exception instanceof Error ? exception : undefined);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: errorName,
      message,
    });
  }
}
