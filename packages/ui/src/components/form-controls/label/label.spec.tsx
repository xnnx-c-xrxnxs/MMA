import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label', () => {
  it('renders children', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('forwards htmlFor to the underlying label', () => {
    render(<Label htmlFor="my-input">My label</Label>);
    expect(screen.getByText('My label')).toHaveAttribute('for', 'my-input');
  });
});
