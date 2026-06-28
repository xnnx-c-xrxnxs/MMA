import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the default variant when none is given', () => {
    render(<Badge data-testid="b">Default</Badge>);
    expect(screen.getByTestId('b').className).toContain('bg-primary');
  });

  it.each([
    ['success', 'bg-success-bg'],
    ['warning', 'bg-warning-bg'],
    ['danger', 'bg-danger-bg'],
    ['brand', 'bg-brand-subtle'],
  ] as const)('applies the %s variant class', (variant, expectedClass) => {
    render(
      <Badge variant={variant} data-testid="b">
        Status
      </Badge>,
    );
    expect(screen.getByTestId('b').className).toContain(expectedClass);
  });
});
