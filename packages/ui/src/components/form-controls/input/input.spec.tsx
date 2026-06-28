import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  it('renders an input with placeholder', () => {
    render(<Input placeholder="email" />);
    expect(screen.getByPlaceholderText('email')).toBeInTheDocument();
  });

  it('accepts user typing', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="email" />);
    await user.type(screen.getByPlaceholderText('email'), 'ada');
    expect(screen.getByPlaceholderText('email')).toHaveValue('ada');
  });

  it('shows an error message and marks aria-invalid when error is set', () => {
    render(<Input defaultValue="x" error="Invalid" />);
    const input = screen.getByDisplayValue('x');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('respects disabled prop', () => {
    render(<Input disabled defaultValue="x" />);
    expect(screen.getByDisplayValue('x')).toBeDisabled();
  });
});
