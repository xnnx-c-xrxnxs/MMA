import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Header } from './header';

describe('Header', () => {
  it('should render the title', () => {
    render(<Header title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should render in a heading element', () => {
    render(<Header title="Dashboard" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
