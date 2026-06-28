import type { Meta, StoryObj } from '@storybook/react';
import { Toaster, toast } from './toast';
import { Button } from '../../form-controls/button';

const meta: Meta<typeof Toaster> = {
  title: 'Feedback/Toast',
  component: Toaster,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="space-x-2">
      <Toaster />
      <Button onClick={() => toast('Saved')}>Default</Button>
      <Button variant="brand" onClick={() => toast.success('Operation complete')}>
        Success
      </Button>
      <Button variant="destructive" onClick={() => toast.error('Something went wrong')}>
        Error
      </Button>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div>
      <Toaster />
      <Button
        onClick={() =>
          toast('Project archived', {
            description: 'You can restore it from the trash within 30 days.',
          })
        }
      >
        Show toast with description
      </Button>
    </div>
  ),
};
