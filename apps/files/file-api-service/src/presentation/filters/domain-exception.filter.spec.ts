import { DomainExceptionFilter } from './domain-exception.filter';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

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
    const body = { statusCode: 400, message: ['filename is required'], error: 'Bad Request' };
    const exception = new HttpException(body, HttpStatus.BAD_REQUEST);
    filter.catch(exception, host);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(body);
  });

  it('handles NestJS NotFoundException (extends HttpException)', () => {
    const { host, mockStatus } = makeHost();
    filter.catch(new NotFoundException('Resource not found'), host);
    expect(mockStatus).toHaveBeenCalledWith(404);
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

  it('returns 500 for a custom Error subclass', () => {
    const { host, mockStatus, mockJson } = makeHost();
    class S3UploadError extends Error {
      constructor() {
        super('S3 upload failed');
        this.name = 'S3UploadError';
      }
    }
    filter.catch(new S3UploadError(), host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'S3 upload failed' }),
    );
  });

  it('returns 500 with UnknownError for non-Error exceptions', () => {
    const { host, mockStatus, mockJson } = makeHost();
    filter.catch('something unexpected', host);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'UnknownError',
        message: 'An unexpected error occurred',
      }),
    );
  });
});
