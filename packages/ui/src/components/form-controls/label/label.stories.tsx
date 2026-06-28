import type { Meta, StoryObj } from '@storybook/react';
import { Label } from './label';
import { Input } from '../input';

const meta: Meta<typeof Label> = {
  title: 'Form Controls/Label',
  component: Label,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  render: () => <Label htmlFor="email">Email address</Label>,
};

export const WithInput: Story = {
  render: () => (
    <div className="w-72 space-y-1.5">
      <Label htmlFor="email-2">Email address</Label>
      <Input id="email-2" placeholder="you@example.com" />
    </div>
  ),
};
