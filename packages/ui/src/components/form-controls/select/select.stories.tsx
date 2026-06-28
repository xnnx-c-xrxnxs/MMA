import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './select';

const meta: Meta<typeof Select> = {
  title: 'Form Controls/Select',
  component: Select,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <div className="w-72">
      <Select defaultValue="active">
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="suspended">Suspended</option>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-72">
      <Select disabled defaultValue="active">
        <option value="active">Active</option>
      </Select>
    </div>
  ),
};
