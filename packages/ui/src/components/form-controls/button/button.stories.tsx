import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { AddIcon } from '../../../icons';

const meta: Meta<typeof Button> = {
  title: 'Form Controls/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'brand', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Click me' },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Brand: Story = { args: { variant: 'brand' } };

export const Destructive: Story = { args: { variant: 'destructive' } };

export const Outline: Story = { args: { variant: 'outline' } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add">
        <AddIcon />
      </Button>
    </div>
  ),
};

export const Loading: Story = { args: { loading: true } };

export const Disabled: Story = { args: { disabled: true } };
