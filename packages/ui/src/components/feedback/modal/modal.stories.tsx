import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { Button } from '../../form-controls/button';
import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalDescription,
    ModalFooter,
    ModalHeader,
    ModalTitle,
    ModalTrigger,
} from './modal';

type ModalSize = ComponentProps<typeof ModalContent>['size'];

type ModalStoryArgs = ComponentProps<typeof Modal> & {
    size: ModalSize;
    title: string;
    description: string;
    triggerLabel: string;
    primaryActionLabel: string;
    secondaryActionLabel: string;
    bodyContent: string;
    bodyClassName?: string;
};

const meta: Meta<ModalStoryArgs> = {
    title: 'Feedback/Modal',
    component: Modal,
    tags: ['autodocs'],
    args: {
        defaultOpen: false,
        size: 'md',
        title: 'This is a dummy header text',
        description: 'This is a dummy description text.',
        triggerLabel: 'Open modal',
        secondaryActionLabel: 'Action',
        primaryActionLabel: 'Action',
        bodyContent: 'This is dummy modal body content.',
        bodyClassName: undefined,
    },
    argTypes: {
        defaultOpen: { control: 'boolean' },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
        },
        title: { control: 'text' },
        description: { control: 'text' },
        triggerLabel: { control: 'text' },
        secondaryActionLabel: { control: 'text' },
        primaryActionLabel: { control: 'text' },
        bodyContent: { control: 'text' },
        bodyClassName: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<ModalStoryArgs>;

export const Default: Story = {
    render: ({
        defaultOpen,
        size,
        title,
        description,
        triggerLabel,
        secondaryActionLabel,
        primaryActionLabel,
        bodyContent,
        bodyClassName,
    }) => (
        <Modal defaultOpen={defaultOpen}>
            <ModalTrigger asChild>
                <Button variant="outline">{triggerLabel}</Button>
            </ModalTrigger>
            <ModalContent size={size}>
                <ModalHeader>
                    <ModalTitle>{title}</ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className={bodyClassName}>
                    <ModalDescription>{description}</ModalDescription>
                    {bodyContent}
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" size="sm">
                        {secondaryActionLabel}
                    </Button>
                    <Button variant="brand" size="sm">
                        {primaryActionLabel}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    ),
};

export const Large: Story = {
    args: {
        defaultOpen: true,
        size: 'lg',
    },
    render: ({
        defaultOpen,
        size,
        title,
        description,
        secondaryActionLabel,
        primaryActionLabel,
        bodyContent,
        bodyClassName,
    }) => (
        <Modal defaultOpen={defaultOpen}>
            <ModalContent size={size}>
                <ModalHeader>
                    <ModalTitle>{title}</ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className={bodyClassName}>
                    <ModalDescription>{description}</ModalDescription>
                    {bodyContent}
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" size="sm">
                        {secondaryActionLabel}
                    </Button>
                    <Button variant="brand" size="sm">
                        {primaryActionLabel}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    ),
};

export const Small: Story = {
    args: {
        defaultOpen: true,
        size: 'sm',
        bodyClassName: 'min-h-20',
    },
    render: ({
        defaultOpen,
        size,
        title,
        description,
        secondaryActionLabel,
        primaryActionLabel,
        bodyContent,
        bodyClassName,
    }) => (
        <Modal defaultOpen={defaultOpen}>
            <ModalContent size={size}>
                <ModalHeader>
                    <ModalTitle className="text-sm leading-5">{title}</ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className={bodyClassName}>
                    <ModalDescription>{description}</ModalDescription>
                    {bodyContent}
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" size="sm">
                        {secondaryActionLabel}
                    </Button>
                    <Button variant="brand" size="sm">
                        {primaryActionLabel}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    ),
};
