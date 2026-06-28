import { DomainExceptionFilter } from './domain-exception.filter';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerNotFoundError,
  CustomerAlreadyExistsError,
  CustomerAlreadyInactiveError,
  InvalidInputError,
  InvalidCustomerTierError,
  InvalidCustomerNameError,
} from '@mma/customer-domain';

function makeHost() {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest
    .fn()
    .mockReturnValue({ status: mockStatus, json: mockJson });
  const host = {
    switchToHttp: jest.fn().mockReturnValue({ getResponse: mockGetResponse }),
  } as unknown as ArgumentsHost;
  return { host, mockStatus, mockJson };
}

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
  });

  it('handles HttpException with string response', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not found' }),
    );
  });

  it('handles HttpException with object response (preserves Zod issues)', () => {
    const { host, mockStatus, mockJson } = makeHost();
    const body = {
      statusCode: 400,
      message: ['name is required'],
      error: 'Bad Request',
    };
    filter.catch(new HttpException(body, HttpStatus.BAD_REQUEST), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(body);
  });

  it('handles NestJS NotFoundException (extends HttpException)', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new NotFoundException('Resource not found'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('logs at error level for 5xx HttpException', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new InternalServerErrorException('boom'), host);
    expect(mockStatus).toHaveBeenCalledWith(500);
  });

  it('maps CustomerNotFoundError to 404', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new CustomerNotFoundError('cust-1'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'CustomerNotFoundError',
      }),
    );
  });

  it('maps CustomerAlreadyExistsError to 409', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new CustomerAlreadyExistsError('a@b.com'), host);
    expect(mockStatus).toHaveBeenCalledWith(409);
  });

  it('maps CustomerAlreadyInactiveError to 409', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new CustomerAlreadyInactiveError(), host);
    expect(mockStatus).toHaveBeenCalledWith(409);
  });

  it('maps InvalidInputError to 400', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new InvalidInputError('id is required'), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('maps InvalidCustomerTierError to 400', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new InvalidCustomerTierError('PLATINUM'), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('maps InvalidCustomerNameError to 400', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new InvalidCustomerNameError(), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('returns 500 with error class name and message for unknown Error', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new Error('something unexpected'), host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Error',
        message: 'something unexpected',
      }),
    );
  });

  it('returns 500 with UnknownError for non-Error exceptions', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch('boom', host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'UnknownError' }),
    );
  });
});
