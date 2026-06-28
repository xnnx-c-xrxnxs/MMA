import { Injectable } from '@nestjs/common';
import { createLogger, getOutboundHeaders } from '@old-st/telemetry';

const logger = createLogger('order-api-service');
import {
  ICustomerValidator,
  ValidatedCustomer,
  CustomerNotFoundError,
  CustomerInvalidStatusError,
  CustomerServiceUnavailableError,
} from '@old-st/order-domain';

@Injectable()
export class UserApiClient extends ICustomerValidator {
  private readonly baseUrl = process.env.API_USER_URL ?? '';

  async validate(customerId: string): Promise<ValidatedCustomer> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(customerId)}`;

    logger.info('Validating customer via User API', { customerId });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // getOutboundHeaders() spreads BOTH the originating request's
          // Authorization header AND the correlationId — captured by
          // correlationMiddleware() and stored in AsyncLocalStorage.
          // The downstream service's @CurrentUser() resolves to the same
          // actor end-to-end and the correlation chain stays intact.
          ...getOutboundHeaders(),
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      logger.error('Unexpected error calling user API', {}, error);
      throw new CustomerServiceUnavailableError();
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new CustomerNotFoundError(customerId);
      }
      if (response.status === 409) {
        let msg = 'invalid status';
        try {
          const body = (await response.json()) as { message?: string };
          if (body.message) {
            msg = body.message;
          }
        } catch {
          // ignore JSON parse failure
        }
        throw new CustomerInvalidStatusError(customerId, msg);
      }
      logger.error('Upstream user API error', { status: response.status, statusText: response.statusText });
      throw new CustomerServiceUnavailableError(
        `Upstream user API returned ${response.status}`,
      );
    }

    const data = (await response.json()) as { userId: string; userStatus: string };

    const validated: ValidatedCustomer = {
      customerId: data.userId,
      status: data.userStatus,
    };

    // Gate check: only ACTIVE customers can place/confirm orders
    const validStatuses = ['ACTIVE'];
    if (!validStatuses.includes(validated.status)) {
      throw new CustomerInvalidStatusError(customerId, validated.status);
    }

    logger.info('Customer validated successfully', { customerId, status: validated.status });

    return validated;
  }
}
