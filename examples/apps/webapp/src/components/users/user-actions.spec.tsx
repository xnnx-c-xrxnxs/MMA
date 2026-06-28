jest.mock('@old-st/client-common', () => ({
  useDeleteUser: jest.fn(() => ({ mutate: jest.fn() })),
  useActivateUser: jest.fn(() => ({ mutate: jest.fn() })),
  useDeactivateUser: jest.fn(() => ({ mutate: jest.fn() })),
  useVerifyUserEmail: jest.fn(() => ({ mutate: jest.fn() })),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserActions } from './user-actions';
import { useDeleteUser, useActivateUser, useDeactivateUser, useVerifyUserEmail } from '@old-st/client-common';
import type { UserResponse } from '@old-st/contracts/user';

function makeUser(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    userId: 'u-1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    userRole: 'USER',
    userStatus: 'ACTIVE',
    emailVerified: true,
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show Deactivate and Delete for ACTIVE user', () => {
    render(<UserActions user={makeUser({ userStatus: 'ACTIVE' })} />);
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
  });

  it('should show Verify, Activate, and Delete for PENDING user', () => {
    render(<UserActions user={makeUser({ userStatus: 'PENDING' })} />);
    expect(screen.getByText('Verify')).toBeInTheDocument();
    expect(screen.getByText('Activate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should show Activate and Delete for INACTIVE user', () => {
    render(<UserActions user={makeUser({ userStatus: 'INACTIVE' })} />);
    expect(screen.getByText('Activate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });

  it('should show no actions for DELETED user', () => {
    render(<UserActions user={makeUser({ userStatus: 'DELETED' })} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
  });

  it('should call deactivateUser on click', () => {
    const mockMutate = jest.fn();
    (useDeactivateUser as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<UserActions user={makeUser({ userStatus: 'ACTIVE' })} />);
    fireEvent.click(screen.getByText('Deactivate'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });

  it('should call verifyEmail on click', () => {
    const mockMutate = jest.fn();
    (useVerifyUserEmail as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<UserActions user={makeUser({ userStatus: 'PENDING' })} />);
    fireEvent.click(screen.getByText('Verify'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });

  it('should call activateUser on click', () => {
    const mockMutate = jest.fn();
    (useActivateUser as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<UserActions user={makeUser({ userStatus: 'INACTIVE' })} />);
    fireEvent.click(screen.getByText('Activate'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });

  it('should call deleteUser on click', () => {
    const mockMutate = jest.fn();
    (useDeleteUser as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<UserActions user={makeUser({ userStatus: 'ACTIVE' })} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });
});
