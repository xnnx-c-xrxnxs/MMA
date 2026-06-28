import type { Meta, StoryObj } from '@storybook/react';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Button } from '../../form-controls/button';

const meta: Meta<typeof Popover> = {
  title: 'Feedback/Popover',
  component: Popover,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm">Popover content lives here.</p>
      </PopoverContent>
    </Popover>
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Anchor</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm font-medium">Pinned open</p>
        <p className="text-xs text-muted-foreground">For visual reference.</p>
      </PopoverContent>
    </Popover>
  ),
};
