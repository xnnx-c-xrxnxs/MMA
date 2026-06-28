import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies variant + size classes via cva', () => {
    render(<Button variant="brand" size="lg">Brand</Button>);
    const btn = screen.getByRole('button', { name: 'Brand' });
    expect(btn.className).toContain('bg-brand');
    expect(btn.className).toContain('h-10');
  });

  it('disables and shows aria-busy when loading', () => {
    render(<Button loading>Submitting</Button>);
    const btn = screen.getByRole('button', { name: 'Submitting' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('respects explicit disabled prop', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });

  it('forwards ref to the underlying button', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
