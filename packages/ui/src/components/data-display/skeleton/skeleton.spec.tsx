import { render } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('applies default variant classes', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
    expect(container.firstChild).toHaveClass('h-4');
  });

  it('applies card variant classes', () => {
    const { container } = render(<Skeleton variant="card" />);
    expect(container.firstChild).toHaveClass('h-28');
  });

  it('applies line variant classes', () => {
    const { container } = render(<Skeleton variant="line" />);
    expect(container.firstChild).toHaveClass('h-3');
  });

  it('forwards className', () => {
    const { container } = render(<Skeleton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
