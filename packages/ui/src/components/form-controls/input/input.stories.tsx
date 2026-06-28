import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Form Controls/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'you@example.com' },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
};

export const Filled: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} defaultValue="ada@example.com" />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} disabled defaultValue="ada@example.com" />
    </div>
  ),
};

export const WithError: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} defaultValue="not-an-email" error="Enter a valid email address" />
    </div>
  ),
};
