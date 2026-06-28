import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Feedback/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};

export const InheritsTextColor: Story = {
  render: () => (
    <div className="text-brand">
      <Spinner />
    </div>
  ),
};
