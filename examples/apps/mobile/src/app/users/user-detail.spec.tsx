import { render, screen, fireEvent } from '@testing-library/react-native';
import UserDetailScreen from './[userId]';
import { UserStatusEnum } from '@old-st/contracts/user';

const mockMutate = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ userId: 'u-1' }),
  Stack: { Screen: () => null },
}));

jest.mock('@old-st/client-common', () => ({
  useUser: jest.fn(),
  useActivateUser: () => ({ mutate: mockMutate, isPending: false }),
  useDeactivateUser: () => ({ mutate: mockMutate, isPending: false }),
  formatUserStatus: (s: string) => s,
}));

const { useUser } = jest.requireMock('@old-st/client-common');

const baseUser = {
  userId: 'u-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  userRole: 'USER',
  data: {},
  dateCreated: '2025-06-15T00:00:00.000Z',
  updatedAt: '2025-06-16T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UserDetailScreen', () => {
  it('renders loading indicator when data is loading', () => {
    useUser.mockReturnValue({ data: undefined, isLoading: true });

    render(<UserDetailScreen />);

    expect(screen.queryByText('Alice Smith')).toBeNull();
  });

  it('renders user details when loaded', () => {
    useUser.mockReturnValue({
      data: { ...baseUser, userStatus: UserStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<UserDetailScreen />);

    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
    expect(screen.getByText('USER')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('shows Activate button for PENDING users', () => {
    useUser.mockReturnValue({
      data: { ...baseUser, userStatus: UserStatusEnum.PENDING },
      isLoading: false,
    });

    render(<UserDetailScreen />);

    expect(screen.getByText('Activate')).toBeTruthy();
    expect(screen.queryByText('Deactivate')).toBeNull();
  });

  it('shows Deactivate button for ACTIVE users', () => {
    useUser.mockReturnValue({
      data: { ...baseUser, userStatus: UserStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<UserDetailScreen />);

    expect(screen.getByText('Deactivate')).toBeTruthy();
    expect(screen.queryByText('Activate')).toBeNull();
  });

  it('shows no action buttons for INACTIVE users', () => {
    useUser.mockReturnValue({
      data: { ...baseUser, userStatus: UserStatusEnum.INACTIVE },
      isLoading: false,
    });

    render(<UserDetailScreen />);

    expect(screen.queryByText('Activate')).toBeNull();
    expect(screen.queryByText('Deactivate')).toBeNull();
  });

  it('calls activate mutation on Activate press', () => {
    useUser.mockReturnValue({
      data: { ...baseUser, userStatus: UserStatusEnum.PENDING },
      isLoading: false,
    });

    render(<UserDetailScreen />);

    fireEvent.press(screen.getByText('Activate'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });

  it('calls deactivate mutation on Deactivate press', () => {
    useUser.mockReturnValue({
      data: { ...baseUser, userStatus: UserStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<UserDetailScreen />);

    fireEvent.press(screen.getByText('Deactivate'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });
});
