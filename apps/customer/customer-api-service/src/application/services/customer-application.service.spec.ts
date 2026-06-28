import { CustomerApplicationService } from './customer-application.service';

jest.mock('@mma/contracts/customer', () => ({
  ...(jest.requireActual('@mma/contracts/customer') as object),
  customerResponseSchema: { parse: jest.fn((input: unknown) => input) },
}));

describe('CustomerApplicationService', () => {
  const mockCreate = { execute: jest.fn() };
  const mockGet = { execute: jest.fn() };
  const mockGetByUserId = { execute: jest.fn() };
  const mockUpdate = { execute: jest.fn() };
  const mockDeactivate = { execute: jest.fn() };
  const mockListByStatus = { execute: jest.fn() };
  const mockListByTier = { execute: jest.fn() };
  let service: CustomerApplicationService;

  const fakeEntity = {
    getCustomerId: () => 'cust-1',
    getName: () => 'Acme',
    getEmail: () => 'a@b.com',
    getUserId: () => undefined,
    getCompany: () => undefined,
    getTier: () => 'FREE',
    getCustomerStatus: () => 'ACTIVE',
    getDateCreated: () => '2020-01-01T00:00:00.000Z',
    getUpdatedAt: () => '2020-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomerApplicationService(
      mockCreate as never,
      mockGet as never,
      mockGetByUserId as never,
      mockUpdate as never,
      mockDeactivate as never,
      mockListByStatus as never,
      mockListByTier as never,
    );
  });

  it('createCustomer delegates and returns a DTO', async () => {
    mockCreate.execute.mockResolvedValue(fakeEntity);
    const result = await service.createCustomer(
      { name: 'Acme', email: 'a@b.com' },
      'actor-1',
    );
    expect(mockCreate.execute).toHaveBeenCalled();
    expect(result).toMatchObject({ customerId: 'cust-1' });
  });

  it('getCustomerById delegates', async () => {
    mockGet.execute.mockResolvedValue(fakeEntity);
    await service.getCustomerById('cust-1');
    expect(mockGet.execute).toHaveBeenCalledWith('cust-1');
  });

  it('getCustomerByUserId delegates', async () => {
    mockGetByUserId.execute.mockResolvedValue(fakeEntity);
    await service.getCustomerByUserId('user-1');
    expect(mockGetByUserId.execute).toHaveBeenCalledWith('user-1');
  });

  it('deactivateCustomer delegates', async () => {
    mockDeactivate.execute.mockResolvedValue(fakeEntity);
    await service.deactivateCustomer('cust-1', 'actor-1');
    expect(mockDeactivate.execute).toHaveBeenCalledWith({
      customerId: 'cust-1',
    });
  });

  describe('cursor routing (listByStatus)', () => {
    it('routes cursor to nextCursorPointer when direction next', async () => {
      mockListByStatus.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: null,
        prevCursorPointer: null,
      });
      await service.listCustomersByStatus('ACTIVE', 20, 'next', 'abc');
      expect(mockListByStatus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          nextCursorPointer: 'abc',
          prevCursorPointer: undefined,
        }),
      );
    });

    it('routes cursor to prevCursorPointer when direction prev', async () => {
      mockListByStatus.execute.mockResolvedValue({
        data: [],
        nextCursorPointer: null,
        prevCursorPointer: null,
      });
      await service.listCustomersByStatus('ACTIVE', 20, 'prev', 'abc');
      expect(mockListByStatus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          nextCursorPointer: undefined,
          prevCursorPointer: 'abc',
        }),
      );
    });
  });
});
