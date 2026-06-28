jest.mock('@old-st/client-common', () => ({
  useCreateUser: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateUserForm } from './create-user-form';
import { useCreateUser } from '@old-st/client-common';

describe('CreateUserForm', () => {
  const mockMutate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateUser as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
    });
  });

  it('renders all form fields', () => {
    render(<CreateUserForm onClose={mockOnClose} />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('First name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders role select with USER and ADMIN options', () => {
    render(<CreateUserForm onClose={mockOnClose} />);
    expect(screen.getByText('USER')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('calls mutate with form data on submit', () => {
    render(<CreateUserForm onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Smith' } });
    fireEvent.submit(screen.getByTestId('create-user-form'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' }),
      expect.any(Object),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<CreateUserForm onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('disables submit button and shows Creating... when isPending', () => {
    (useCreateUser as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: true, isError: false });
    render(<CreateUserForm onClose={mockOnClose} />);
    const btn = screen.getByText('Creating...');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('shows error message when isError is true', () => {
    (useCreateUser as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { message: 'Email already exists' },
    });
    render(<CreateUserForm onClose={mockOnClose} />);
    expect(screen.getByText('Email already exists')).toBeInTheDocument();
  });

  it('calls onClose on successful submission', () => {
    const capturedMutate = jest.fn((_input: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    (useCreateUser as jest.Mock).mockReturnValue({ mutate: capturedMutate, isPending: false, isError: false });
    render(<CreateUserForm onClose={mockOnClose} />);
    fireEvent.submit(screen.getByTestId('create-user-form'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
