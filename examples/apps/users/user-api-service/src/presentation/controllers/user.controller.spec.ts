import { UserController } from './user.controller';
import { UserApplicationService } from '../../application/services/user-application.service';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserApplicationService>;

  beforeEach(() => {
    service = {
      createUser: jest.fn(),
      getUserById: jest.fn(),
      getUserByEmail: jest.fn(),
      updateUserProfile: jest.fn(),
      deleteUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      activateUser: jest.fn(),
      deactivateUser: jest.fn(),
      updateUserRole: jest.fn(),
      listUsersByStatus: jest.fn(),
      listUsersByRoleAndStatus: jest.fn(),
    } as unknown as jest.Mocked<UserApplicationService>;

    controller = new UserController(service);
  });

  it('createUser delegates to service', () => {
    const body = { email: 'a@b.com', firstName: 'A', lastName: 'B', userRole: 'USER' as const };
    controller.createUser(body);
    expect(service.createUser).toHaveBeenCalledWith(body);
  });

  it('getUserById delegates to service', () => {
    controller.getUserById('usr-1');
    expect(service.getUserById).toHaveBeenCalledWith('usr-1');
  });

  it('getUserByEmail delegates to service', () => {
    controller.getUserByEmail({ email: 'a@b.com' });
    expect(service.getUserByEmail).toHaveBeenCalledWith('a@b.com');
  });

  it('updateUserProfile delegates to service', () => {
    const body = { firstName: 'Updated' };
    controller.updateUserProfile('usr-1', body);
    expect(service.updateUserProfile).toHaveBeenCalledWith('usr-1', body);
  });

  it('deleteUser delegates to service', async () => {
    service.deleteUser.mockResolvedValue(undefined);
    await controller.deleteUser('usr-1');
    expect(service.deleteUser).toHaveBeenCalledWith('usr-1');
  });

  it('verifyUserEmail delegates to service', () => {
    controller.verifyUserEmail('usr-1');
    expect(service.verifyUserEmail).toHaveBeenCalledWith('usr-1');
  });

  it('activateUser delegates to service', () => {
    controller.activateUser('usr-1');
    expect(service.activateUser).toHaveBeenCalledWith('usr-1');
  });

  it('deactivateUser delegates to service', () => {
    controller.deactivateUser('usr-1');
    expect(service.deactivateUser).toHaveBeenCalledWith('usr-1');
  });

  it('updateUserRole delegates to service', () => {
    controller.updateUserRole('usr-1', { userRole: 'ADMIN' });
    expect(service.updateUserRole).toHaveBeenCalledWith('usr-1', 'ADMIN');
  });

  it('listUsersByStatus delegates to service', () => {
    const query = { userStatus: 'ACTIVE' as const, limit: 20, direction: 'next' as const };
    controller.listUsersByStatus(query);
    expect(service.listUsersByStatus).toHaveBeenCalledWith(query);
  });

  it('listUsersByRoleAndStatus delegates to service', () => {
    const query = { userRole: 'USER' as const, userStatus: 'ACTIVE' as const, limit: 20, direction: 'next' as const };
    controller.listUsersByRoleAndStatus(query);
    expect(service.listUsersByRoleAndStatus).toHaveBeenCalledWith(query);
  });
});
