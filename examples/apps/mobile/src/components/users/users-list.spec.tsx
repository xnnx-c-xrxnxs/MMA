import { render, screen, fireEvent } from '@testing-library/react-native';
import { UsersList } from './users-list';
import type { UserResponse } from '@old-st/contracts/user';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUser: UserResponse = {
  userId: 'u-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  userRole: 'USER',
  userStatus: 'ACTIVE',
  data: {},
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

const mockUser2: UserResponse = {
  userId: 'u-2',
  email: 'bob@example.com',
  firstName: 'Bob',
  lastName: 'Jones',
  userRole: 'ADMIN',
  userStatus: 'PENDING',
  data: {},
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('UsersList', () => {
  it('renders user items with name, email, status and role', () => {
    render(<UsersList users={[mockUser, mockUser2]} isLoading={false} />);

    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Role: USER')).toBeTruthy();

    expect(screen.getByText('Bob Jones')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('shows loading indicator when loading with no data', () => {
    render(<UsersList users={[]} isLoading={true} />);

    expect(screen.queryByText('No users found')).toBeNull();
  });

  it('shows empty message when no users and not loading', () => {
    render(<UsersList users={[]} isLoading={false} />);

    expect(screen.getByText('No users found')).toBeTruthy();
  });

  it('navigates to user detail on press', () => {
    render(<UsersList users={[mockUser]} isLoading={false} />);

    fireEvent.press(screen.getByText('Alice Smith'));
    expect(mockPush).toHaveBeenCalledWith('/users/u-1');
  });
});
