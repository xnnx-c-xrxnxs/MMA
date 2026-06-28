jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@mma/client-common', () => ({
  useAuth: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from './sidebar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@mma/client-common';

const mockUsePathname = usePathname as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, signOut: jest.fn() });
  });

  it('should render the dashboard navigation item', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render the brand name', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    expect(screen.getByText('Old ST Admin')).toBeInTheDocument();
  });

  it('should show user info and sign-out button when user is logged in', () => {
    mockUsePathname.mockReturnValue('/');
    const mockSignOut = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', userId: '123' },
      signOut: mockSignOut,
    });

    render(<Sidebar />);

    expect(screen.getByTestId('user-info-display')).toHaveTextContent('test@example.com');
    expect(screen.getByTestId('sign-out-btn')).toBeInTheDocument();
    expect(screen.getByTestId('change-password-link')).toBeInTheDocument();
  });

  it('should call signOut when sign-out button is clicked', () => {
    mockUsePathname.mockReturnValue('/');
    const mockSignOut = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', userId: '123' },
      signOut: mockSignOut,
    });

    render(<Sidebar />);

    screen.getByTestId('sign-out-btn').click();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows active style on dashboard link when at root', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    const link = screen.getByTestId('sidebar-link-dashboard');
    expect(link).toHaveClass('bg-accent');
  });
});
