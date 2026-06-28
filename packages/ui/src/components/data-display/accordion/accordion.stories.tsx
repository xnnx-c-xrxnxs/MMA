import type { Meta, StoryObj } from '@storybook/react';
import { ArrowLeftIcon, ArrowRightIcon } from '../../../icons';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'Data Display/Accordion',
  component: Accordion,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Accordion>;

const storyContainerClassName = 'w-64';

export const Default: Story = {
  render: () => (
    <Accordion className={storyContainerClassName} collapsible type="single">
      <AccordionItem value="item-1">
        <AccordionTrigger>Your accordion title goes here</AccordionTrigger>
        <AccordionContent>
          This is the accordion body content. It expands and collapses with state-aware styles.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Expanded: Story = {
  render: () => (
    <Accordion
      className={storyContainerClassName}
      collapsible
      defaultValue="item-1"
      type="single"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>Your accordion title goes here</AccordionTrigger>
        <AccordionContent>
          The expanded state includes body content spacing based on the Figma component.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const ExpandedWithSubtitle: Story = {
  render: () => (
    <Accordion
      className={storyContainerClassName}
      collapsible
      defaultValue="item-1"
      type="single"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger subtitle="Some subtitle can here">
          Your accordion title goes here
        </AccordionTrigger>
        <AccordionContent>
          Expanded state with subtitle enabled for scenarios that need secondary context.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const WithAddons: Story = {
  render: () => (
    <Accordion className={storyContainerClassName} collapsible type="single">
      <AccordionItem value="item-1">
        <AccordionTrigger
          leftAddon={<ArrowRightIcon size={20} />}
          rightAddon={<ArrowLeftIcon size={20} />}
          subtitle="Some subtitle can here"
        >
          Your accordion title goes here
        </AccordionTrigger>
        <AccordionContent>
          Addons align with the trigger content while the chevron remains at the far right.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Accordion className={storyContainerClassName} collapsible type="single">
      <AccordionItem disabled value="item-1">
        <AccordionTrigger subtitle="Some subtitle can here">
          Your accordion title goes here
        </AccordionTrigger>
        <AccordionContent>
          This content should not open because the item is disabled.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Dark: Story = {
  render: () => (
    <div className="dark bg-background p-6">
      <Accordion
        className={storyContainerClassName}
        collapsible
        defaultValue="item-1"
        type="single"
      >
        <AccordionItem value="item-1">
          <AccordionTrigger subtitle="Some subtitle can here">
            Your accordion title goes here
          </AccordionTrigger>
          <AccordionContent>
            Dark mode uses semantic tokens and does not require component-level theme branching.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const MultiItem: Story = {
  render: () => (
    <Accordion
      className={`${storyContainerClassName} space-y-2`}
      collapsible
      type="single"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>First item</AccordionTrigger>
        <AccordionContent>Body for the first item.</AccordionContent>
      </AccordionItem>

      <AccordionItem value="item-2">
        <AccordionTrigger>Second item</AccordionTrigger>
        <AccordionContent>Body for the second item.</AccordionContent>
      </AccordionItem>

      <AccordionItem value="item-3">
        <AccordionTrigger>Third item</AccordionTrigger>
        <AccordionContent>Body for the third item.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
