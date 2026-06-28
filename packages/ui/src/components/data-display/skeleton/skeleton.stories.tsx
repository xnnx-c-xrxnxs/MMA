import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Data Display/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'line', 'card'] },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <Skeleton />
      <Skeleton />
      <Skeleton className="w-3/4" />
    </div>
  ),
};

export const Line: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" className="w-1/2" />
    </div>
  ),
};

export const CardVariant: Story = {
  name: 'Card',
  render: () => (
    <div className="w-72">
      <Skeleton variant="card" />
    </div>
  ),
};
