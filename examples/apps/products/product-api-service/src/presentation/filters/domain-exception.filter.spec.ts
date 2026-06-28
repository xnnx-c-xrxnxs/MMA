import { DomainExceptionFilter } from './domain-exception.filter';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import {
  ProductNotFoundError,
  CategoryNotFoundError,
  InvalidInputError,
  CannotActivateNonInactiveProductError,
  CategoryNameAlreadyExistsError,
} from '@old-st/product-domain';

function makeHost() {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus, json: mockJson });
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
    const exception = new HttpException('Conflict', HttpStatus.CONFLICT);
    filter.catch(exception, host);
    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: 'Conflict' }),
    );
  });

  it('handles HttpException with object response (preserves Zod issues)', () => {
    const { host, mockStatus, mockJson } = makeHost();
    const body = { statusCode: 400, message: ['price must be positive'], error: 'Bad Request' };
    const exception = new HttpException(body, HttpStatus.BAD_REQUEST);
    filter.catch(exception, host);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(body);
  });

  it('handles NestJS NotFoundException (extends HttpException)', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new NotFoundException('Product not found'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('maps ProductNotFoundError → 404', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new ProductNotFoundError('p-1'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, error: 'ProductNotFoundError' }),
    );
  });

  it('maps CategoryNotFoundError → 404', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new CategoryNotFoundError('c-1'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('maps InvalidInputError → 400', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new InvalidInputError('bad'), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('maps CategoryNameAlreadyExistsError → 409', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new CategoryNameAlreadyExistsError('Electronics'), host);
    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'CategoryNameAlreadyExistsError' }),
    );
  });

  it('maps CannotActivateNonInactiveProductError → 409', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new CannotActivateNonInactiveProductError(), host);
    expect(mockStatus).toHaveBeenCalledWith(409);
  });

  it('returns 500 for unknown errors', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new Error('unexpected'), host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'Error', message: 'unexpected' }),
    );
  });

  it('returns 500 for non-Error exceptions', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(null, host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'UnknownError', message: 'null' }),
    );
  });
});
