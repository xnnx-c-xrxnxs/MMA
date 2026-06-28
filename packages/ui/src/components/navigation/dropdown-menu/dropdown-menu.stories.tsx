import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentPropsWithoutRef } from 'react';
import { Button } from '../../form-controls/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from './dropdown-menu';

type DropdownMenuStoryArgs = {
    triggerLabel: string;
    size: 'md' | 'sm';
    align: ComponentPropsWithoutRef<typeof DropdownMenuContent>['align'];
    sideOffset: number;
};

const meta: Meta<DropdownMenuStoryArgs> = {
    title: 'Navigation/DropdownMenu',
    tags: ['autodocs'],
    argTypes: {
        triggerLabel: {
            control: 'text',
        },
        size: {
            control: 'select',
            options: ['md', 'sm'],
        },
        align: {
            control: 'select',
            options: ['start', 'center', 'end'],
        },
        sideOffset: {
            control: 'number',
        },
    },
    args: {
        triggerLabel: 'Open menu',
        size: 'md',
        align: 'start',
        sideOffset: 4,
    },
};

export default meta;
type Story = StoryObj<DropdownMenuStoryArgs>;

export const Default: Story = {
    render: (args) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">{args.triggerLabel}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={args.align}
                sideOffset={args.sideOffset}
                size={args.size}
            >
                <DropdownMenuLabel size={args.size}>Header</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem size={args.size}>
                    Sample list item <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};

export const Small: Story = {
    args: {
        triggerLabel: 'Open compact menu',
        size: 'sm',
    },
    render: (args) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">{args.triggerLabel}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={args.align}
                sideOffset={args.sideOffset}
                size={args.size}
            >
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
                <DropdownMenuItem size={args.size}>Sample list item</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};

export const WithCheckboxItems: Story = {
    args: {
        triggerLabel: 'Columns',
        size: 'md',
    },
    render: (args) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">{args.triggerLabel}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={args.align}
                sideOffset={args.sideOffset}
                size={args.size}
            >
                <DropdownMenuLabel size={args.size}>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem size={args.size} checked>
                    Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem size={args.size} checked>
                    Email
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem size={args.size} checked>
                    Status
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};
