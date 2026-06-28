import { render, screen } from '@testing-library/react';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('exposes role="status" + default label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('honours a custom label', () => {
    render(<Spinner label="Saving order" />);
    expect(screen.getByRole('status', { name: 'Saving order' })).toBeInTheDocument();
  });

  it('applies the size variant class', () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole('status').getAttribute('class')).toContain('h-10');
  });
});
