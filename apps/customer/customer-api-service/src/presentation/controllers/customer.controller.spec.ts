import { CustomerController } from './customer.controller';
import { CustomerApplicationService } from '../../application/services/customer-application.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

describe('CustomerController', () => {
  let service: jest.Mocked<Partial<CustomerApplicationService>>;
  let controller: CustomerController;
  const actor: AuthenticatedUser = {
    userId: 'actor-1',
    email: 'admin@acme.com',
  };

  beforeEach(() => {
    service = {
      createCustomer: jest.fn(),
      getCustomerById: jest.fn(),
      getCustomerByUserId: jest.fn(),
      updateCustomer: jest.fn(),
      deactivateCustomer: jest.fn(),
      listCustomersByStatus: jest.fn(),
      listCustomersByTier: jest.fn(),
    };
    controller = new CustomerController(
      service as unknown as CustomerApplicationService,
    );
  });

  it('createCustomer passes actor.userId from JWT', () => {
    controller.createCustomer(actor, { name: 'Acme', email: 'a@b.com' });
    expect(service.createCustomer).toHaveBeenCalledWith(
      { name: 'Acme', email: 'a@b.com' },
      'actor-1',
    );
  });

  it('getCustomerById delegates', () => {
    controller.getCustomerById('cust-1');
    expect(service.getCustomerById).toHaveBeenCalledWith('cust-1');
  });

  it('getCustomerByUserId delegates', () => {
    controller.getCustomerByUserId('user-1');
    expect(service.getCustomerByUserId).toHaveBeenCalledWith('user-1');
  });

  it('updateCustomer passes actor.userId', () => {
    controller.updateCustomer(actor, 'cust-1', { name: 'New' });
    expect(service.updateCustomer).toHaveBeenCalledWith(
      'cust-1',
      { name: 'New' },
      'actor-1',
    );
  });

  it('deactivateCustomer passes actor.userId', () => {
    controller.deactivateCustomer(actor, 'cust-1');
    expect(service.deactivateCustomer).toHaveBeenCalledWith(
      'cust-1',
      'actor-1',
    );
  });

  it('listCustomersByTier delegates', () => {
    controller.listCustomersByTier({
      tier: 'PRO',
      limit: 20,
      direction: 'next',
    });
    expect(service.listCustomersByTier).toHaveBeenCalledWith(
      'PRO',
      20,
      'next',
      undefined,
    );
  });
});
