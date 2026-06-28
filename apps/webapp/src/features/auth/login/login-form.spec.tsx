import { useAuth } from '@mma/client-common';
import type { SignInResponse } from '@mma/contracts/auth';
import { toast } from '@mma/ui';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { LoginForm } from './login-form';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@mma/client-common', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@mma/ui', () => ({
  ...jest.requireActual('@mma/ui'),
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseRouter = useRouter as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockToastError = toast.error as jest.Mock;

describe('LoginForm', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  const mockSignIn = jest.fn<Promise<SignInResponse>, [string, string]>();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });

    mockUseAuth.mockReturnValue({
      signIn: mockSignIn,
      isAuthenticated: false,
    });
  });

  it('renders login fields and actions', () => {
    render(<LoginForm />);

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-btn')).toBeInTheDocument();
    expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
  });

  it('submits credentials and redirects to dashboard on SUCCESS', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({
      type: 'SUCCESS',
      tokens: { accessToken: 'a', idToken: 'b', expiresIn: 3600 },
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email Address'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByTestId('sign-in-btn'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('admin@test.com', 'Password123!');
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to new-password flow when challenge is required', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({
      type: 'NEW_PASSWORD_REQUIRED',
      session: 'session-token',
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email Address'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByTestId('sign-in-btn'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/auth/new-password?email=admin%40test.com&session=session-token',
      );
    });
  });

  it('shows auth error and toast when sign in fails', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email Address'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPassword!');
    await user.click(screen.getByTestId('sign-in-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent('Invalid credentials');
      expect(mockToastError).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('returns null and redirects when already authenticated', () => {
    mockUseAuth.mockReturnValue({
      signIn: mockSignIn,
      isAuthenticated: true,
    });

    const { container } = render(<LoginForm />);

    expect(container).toBeEmptyDOMElement();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
