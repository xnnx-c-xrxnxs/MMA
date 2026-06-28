jest.mock('@old-st/client-common', () => ({
  useCreateCategory: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateCategoryForm } from './create-category-form';
import { useCreateCategory } from '@old-st/client-common';

describe('CreateCategoryForm', () => {
  const mockMutate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateCategory as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
    });
  });

  it('renders all form fields', () => {
    render(<CreateCategoryForm onClose={mockOnClose} />);
    expect(screen.getByPlaceholderText('Category name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls mutate with form data on submit', () => {
    render(<CreateCategoryForm onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText('Category name'), { target: { value: 'Electronics' } });
    fireEvent.change(screen.getByPlaceholderText('Description (optional)'), { target: { value: 'Electronic goods' } });
    fireEvent.submit(screen.getByPlaceholderText('Category name').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Electronics', description: 'Electronic goods' }),
      expect.any(Object),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<CreateCategoryForm onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('disables submit and shows Creating... when isPending', () => {
    (useCreateCategory as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: true, isError: false });
    render(<CreateCategoryForm onClose={mockOnClose} />);
    const btn = screen.getByText('Creating...');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('shows error message when isError is true', () => {
    (useCreateCategory as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { message: 'Category already exists' },
    });
    render(<CreateCategoryForm onClose={mockOnClose} />);
    expect(screen.getByText('Category already exists')).toBeInTheDocument();
  });
});
