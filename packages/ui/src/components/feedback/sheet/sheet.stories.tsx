import type { Meta, StoryObj } from '@storybook/react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from './sheet';
import { Button } from '../../form-controls/button';

const meta: Meta<typeof Sheet> = {
  title: 'Feedback/Sheet',
  component: Sheet,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open right</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit</SheetTitle>
          <SheetDescription>Make changes and save.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Slides in from the left.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
