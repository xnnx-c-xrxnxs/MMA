'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { CloseIcon } from '../../../icons';
import { cn } from '../../../lib/utils';

const modalContentVariants = cva(
    'fixed left-1/2 top-1/2 z-50 grid -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-gray-100 bg-white shadow-[0_16px_48px_-4px_rgba(19,19,20,0.18)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    {
        variants: {
            size: {
                sm: 'w-[22rem] max-w-[calc(100vw-2rem)]',
                md: 'w-[36rem] max-w-[calc(100vw-2rem)]',
                lg: 'w-[56rem] max-w-[calc(100vw-2rem)]',
            },
        },
        defaultVariants: {
            size: 'md',
        },
    },
);

const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalPortal = DialogPrimitive.Portal;
const ModalClose = DialogPrimitive.Close;

function ModalOverlay({
    className,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Overlay>>;
}) {
    return (
        <DialogPrimitive.Overlay
            ref={ref}
            className={cn(
                'fixed inset-0 z-40 bg-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                className,
            )}
            {...props}
        />
    );
}

interface ModalContentProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof modalContentVariants> {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Content>>;
}

function ModalContent({
    className,
    size,
    children,
    ref,
    ...props
}: ModalContentProps) {
    return (
        <ModalPortal>
            <ModalOverlay />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(modalContentVariants({ size }), className)}
                {...props}
            >
                {children}
            </DialogPrimitive.Content>
        </ModalPortal>
    );
}

function ModalHeader({
    className,
    ref,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement>;
}) {
    return (
        <div
            ref={ref}
            className={cn('flex min-h-10 items-center justify-between border-b border-gray-100 px-4 py-2', className)}
            {...props}
        />
    );
}

function ModalTitle({
    className,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Title>>;
}) {
    return (
        <DialogPrimitive.Title
            ref={ref}
            className={cn('text-lg font-extrabold leading-8 text-gray-900', className)}
            {...props}
        />
    );
}

function ModalDescription({
    className,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Description>>;
}) {
    return (
        <DialogPrimitive.Description
            ref={ref}
            className={cn('text-sm leading-6 text-gray-600', className)}
            {...props}
        />
    );
}

function ModalCloseButton({
    className,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Close>>;
}) {
    return (
        <DialogPrimitive.Close
            ref={ref}
            className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-xs text-gray-700 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                className,
            )}
            {...props}
        >
            <CloseIcon size={16} />
            <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
    );
}

function ModalBody({
    children,
    className,
    ref,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement>;
}) {
    return (
        <div
            ref={ref}
            className={cn('min-h-24 border-b border-gray-100 bg-gray-50', className)}
            {...props}
        >
            {children}
        </div>
    );
}

function ModalFooter({
    className,
    ref,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement>;
}) {
    return (
        <div
            ref={ref}
            className={cn('flex items-center justify-end gap-2 px-2 py-2', className)}
            {...props}
        />
    );
}

export {
    Modal,
    ModalBody,
    ModalClose,
    ModalCloseButton,
    ModalContent,
    modalContentVariants,
    ModalDescription,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    ModalPortal,
    ModalTitle,
    ModalTrigger
};
export type { ModalContentProps };
