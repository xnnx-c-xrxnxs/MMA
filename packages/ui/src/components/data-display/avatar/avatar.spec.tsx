import { render, screen } from '@testing-library/react';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it('derives initials from a single-name', () => {
    render(<Avatar name="Ada" />);
    expect(screen.getByRole('img', { name: 'Ada' })).toHaveTextContent('AD');
  });

  it('derives initials from a full name (first + last)', () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('renders explicit children over derived initials', () => {
    render(<Avatar name="Ada Lovelace">XX</Avatar>);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('XX');
  });

  it('applies the size variant class', () => {
    render(<Avatar size="lg" name="Big User" />);
    expect(screen.getByRole('img', { name: 'Big User' }).className).toContain('h-14');
  });

  it('renders empty content when name is whitespace', () => {
    render(<Avatar name="   " data-testid="empty" />);
    expect(screen.getByTestId('empty')).toHaveTextContent('');
  });

  it('renders nothing when neither name nor children are provided', () => {
    render(<Avatar data-testid="bare" />);
    expect(screen.getByTestId('bare')).toHaveTextContent('');
  });
});
