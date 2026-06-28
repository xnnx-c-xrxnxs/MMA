jest.mock('@old-st/client-common', () => ({
  useDeleteUser: jest.fn(() => ({ mutate: jest.fn() })),
  useActivateUser: jest.fn(() => ({ mutate: jest.fn() })),
  useDeactivateUser: jest.fn(() => ({ mutate: jest.fn() })),
  useVerifyUserEmail: jest.fn(() => ({ mutate: jest.fn() })),
  formatUserStatus: (s: string) => s,
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UsersTable } from './users-table';
import type { UserResponse } from '@old-st/contracts/user';

const mockUsers: UserResponse[] = [
  {
    userId: 'u-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    userRole: 'USER',
    userStatus: 'ACTIVE',
    emailVerified: true,
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    userId: 'u-2',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Jones',
    userRole: 'ADMIN',
    userStatus: 'PENDING',
    emailVerified: false,
    dateCreated: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-02-02T00:00:00.000Z',
  },
];

describe('UsersTable', () => {
  it('should render user rows', () => {
    render(<UsersTable users={mockUsers} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(<UsersTable users={mockUsers} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should render badges for role and status', () => {
    render(<UsersTable users={mockUsers} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('USER')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('should show empty message when no users', () => {
    render(<UsersTable users={[]} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should link user name to detail page', () => {
    render(<UsersTable users={mockUsers} />);
    const link = screen.getByText('Alice Smith').closest('a');
    expect(link).toHaveAttribute('href', '/users/u-1');
  });
});
