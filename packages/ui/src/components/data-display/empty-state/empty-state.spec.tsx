import { render, screen } from '@testing-library/react';
import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateAction,
} from './empty-state';

describe('EmptyState', () => {
  it('renders all sub-parts and exposes them by role/text', () => {
    render(
      <EmptyState>
        <EmptyStateIcon data-testid="icon" />
        <EmptyStateTitle>No items</EmptyStateTitle>
        <EmptyStateDescription>Add one to get started.</EmptyStateDescription>
        <EmptyStateAction>
          <button>Add</button>
        </EmptyStateAction>
      </EmptyState>,
    );
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { name: 'No items', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Add one to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});
