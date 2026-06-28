import { render, screen } from '@testing-library/react';
import { Separator } from './separator';

describe('Separator', () => {
  it('renders with horizontal orientation by default', () => {
    render(<Separator data-testid="sep" />);
    const el = screen.getByTestId('sep');
    expect(el).toHaveClass('h-[1px]');
    expect(el).toHaveClass('w-full');
  });

  it('renders vertical orientation when specified', () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    const el = screen.getByTestId('sep');
    expect(el).toHaveClass('w-[1px]');
    expect(el).toHaveClass('h-full');
  });

  it('forwards className', () => {
    render(<Separator className="custom" data-testid="sep" />);
    expect(screen.getByTestId('sep')).toHaveClass('custom');
  });
});
