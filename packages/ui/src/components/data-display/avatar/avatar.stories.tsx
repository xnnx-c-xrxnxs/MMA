import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Data Display/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    name: { control: 'text' },
  },
  args: { name: 'Ada Lovelace' },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const FromName: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="sm" name="Ada Lovelace" />
      <Avatar size="md" name="Grace Hopper" />
      <Avatar size="lg" name="Margaret Hamilton" />
    </div>
  ),
};

export const WithChildren: Story = {
  render: () => <Avatar size="lg">AL</Avatar>,
};
