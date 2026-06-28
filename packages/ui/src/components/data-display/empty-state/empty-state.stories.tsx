import type { Meta, StoryObj } from '@storybook/react';
import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateAction,
} from './empty-state';
import { Button } from '../../form-controls/button';
import { LoadingIcon } from '../../../icons';

const meta: Meta<typeof EmptyState> = {
  title: 'Data Display/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  render: () => (
    <EmptyState>
      <EmptyStateIcon>
        <LoadingIcon />
      </EmptyStateIcon>
      <EmptyStateTitle>No time entries yet</EmptyStateTitle>
      <EmptyStateDescription>
        Start a timer to track your first entry of the day.
      </EmptyStateDescription>
      <EmptyStateAction>
        <Button variant="brand">Start timer</Button>
      </EmptyStateAction>
    </EmptyState>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <EmptyState>
      <EmptyStateTitle>Nothing to show</EmptyStateTitle>
    </EmptyState>
  ),
};
