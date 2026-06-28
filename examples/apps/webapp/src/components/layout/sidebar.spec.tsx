jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@old-st/client-common', () => ({
  useAuth: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from './sidebar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@old-st/client-common';

const mockUsePathname = usePathname as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, signOut: jest.fn() });
  });

  it('should render all navigation items', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('should render the brand name', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    expect(screen.getByText('Old ST Admin')).toBeInTheDocument();
  });

  it('should have correct links', () => {
    mockUsePathname.mockReturnValue('/users');
    render(<Sidebar />);

    const usersLink = screen.getByText('Users').closest('a');
    expect(usersLink).toHaveAttribute('href', '/users');
  });
});
