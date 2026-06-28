import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'Data Display/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'brand', 'secondary', 'destructive', 'outline', 'success', 'warning', 'danger'],
    },
  },
  args: { children: 'Active' },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const StatusVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="brand">Brand</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
