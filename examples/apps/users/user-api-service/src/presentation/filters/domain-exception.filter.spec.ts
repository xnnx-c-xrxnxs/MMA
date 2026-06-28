import { DomainExceptionFilter } from './domain-exception.filter';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import {
  UserNotFoundError,
  EmailAlreadyExistsError,
  InvalidInputError,
  CannotActivateNonPendingUserError,
} from '@old-st/user-domain';

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
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, host);
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not found' }),
    );
  });

  it('handles HttpException with object response (preserves Zod issues)', () => {
    const { host, mockStatus, mockJson } = makeHost();
    const body = { statusCode: 400, message: ['field is required'], error: 'Bad Request' };
    const exception = new HttpException(body, HttpStatus.BAD_REQUEST);
    filter.catch(exception, host);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(body);
  });

  it('handles NestJS NotFoundException (extends HttpException)', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new NotFoundException('User not found'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('maps UserNotFoundError → 404', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new UserNotFoundError('u-1'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, error: 'UserNotFoundError' }),
    );
  });

  it('maps EmailAlreadyExistsError → 409', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new EmailAlreadyExistsError('a@b.com'), host);
    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'EmailAlreadyExistsError' }),
    );
  });

  it('maps InvalidInputError → 400', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new InvalidInputError('bad'), host);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('maps CannotActivateNonPendingUserError → 409', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new CannotActivateNonPendingUserError(), host);
    expect(mockStatus).toHaveBeenCalledWith(409);
  });

  it('returns 500 for unknown errors', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch(new Error('something unexpected'), host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'Error', message: 'something unexpected' }),
    );
  });

  it('returns 500 for non-Error exceptions', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch('something unexpected', host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'UnknownError', message: 'something unexpected' }),
    );
  });
});
