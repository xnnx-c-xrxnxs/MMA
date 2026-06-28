'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '../../../icons';
import { cn } from '../../../lib/utils';

type AccordionProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>;

function Accordion(props: AccordionProps) {
  return <AccordionPrimitive.Root {...props} />;
}

interface AccordionItemProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> {
  ref?: React.Ref<React.ElementRef<typeof AccordionPrimitive.Item>>;
}

function AccordionItem({ className, ref, ...props }: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        'overflow-hidden rounded-md border border-border bg-background',
        className,
      )}
      {...props}
    />
  );
}

const AccordionHeader = AccordionPrimitive.Header;

interface AccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  subtitle?: React.ReactNode;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  hideChevron?: boolean;
  chevronIcon?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof AccordionPrimitive.Trigger>>;
}

function AccordionTrigger({
  className,
  children,
  subtitle,
  leftAddon,
  rightAddon,
  hideChevron,
  chevronIcon,
  ref,
  ...props
}: AccordionTriggerProps) {
  return (
    <AccordionHeader className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'group/accordion flex min-h-14 flex-1 items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted',
          className,
        )}
        {...props}
      >
        {leftAddon ? (
          <div>
          <span className="flex shrink-0 items-center text-muted-foreground">
            {leftAddon}
          </span>
          </div>
        ) : null}

        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span className="text-base font-normal leading-5 text-foreground">
            {children}
          </span>
          {subtitle ? (
            <span className="text-sm leading-5 text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>

        {rightAddon ? (
          <span className="flex shrink-0 items-center text-muted-foreground">
            {rightAddon}
          </span>
        ) : null}

        {!hideChevron
          ? chevronIcon ?? (
              <ChevronDownIcon
                className="shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/accordion:rotate-180"
                size={24}
              />
            )
          : null}
      </AccordionPrimitive.Trigger>
    </AccordionHeader>
  );
}

interface AccordionContentProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> {
  ref?: React.Ref<React.ElementRef<typeof AccordionPrimitive.Content>>;
}

function AccordionContent({ className, children, ref, ...props }: AccordionContentProps) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        'grid overflow-hidden border-t border-border bg-background text-sm text-muted-foreground transition-all data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]',
        className,
      )}
      {...props}
    >
      <div className="min-h-0 px-4 pb-4 pt-3">{children}</div>
    </AccordionPrimitive.Content>
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
};
