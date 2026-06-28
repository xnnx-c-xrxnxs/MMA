'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronRight, Circle } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../../lib/utils';

const dropdownMenuContentVariants = cva('', {
  variants: {
    size: {
      md: 'min-w-[240px]',
      sm: 'min-w-[200px]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const dropdownMenuItemVariants = cva('', {
  variants: {
    size: {
      md: 'gap-2.5 px-4 py-2 text-sm leading-5',
      sm: 'gap-2 px-3 py-1 text-sm leading-5',
    },
    inset: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      size: 'md',
      inset: true,
      className: 'pl-10',
    },
    {
      size: 'sm',
      inset: true,
      className: 'pl-8',
    },
  ],
  defaultVariants: {
    size: 'md',
    inset: false,
  },
});

const dropdownMenuSelectableItemVariants = cva('', {
  variants: {
    size: {
      md: 'pl-10 pr-4',
      sm: 'pl-8 pr-3',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const dropdownMenuIndicatorVariants = cva('absolute flex h-3.5 w-3.5 items-center justify-center', {
  variants: {
    size: {
      md: 'left-4',
      sm: 'left-3',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type DropdownMenuSize = NonNullable<VariantProps<typeof dropdownMenuItemVariants>['size']>;

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
    size?: DropdownMenuSize;
  }
>(({ className, inset, size = 'md', children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-none font-semibold text-gray-900 outline-none transition-colors focus:bg-secondary-100 data-[state=open]:bg-secondary-100',
      dropdownMenuItemVariants({ size, inset }),
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & {
    size?: DropdownMenuSize;
  }
>(({ className, size = 'md', ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 overflow-hidden rounded-md border border-gray-100 bg-white py-1 text-gray-900 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      dropdownMenuContentVariants({ size }),
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    size?: DropdownMenuSize;
  }
>(({ className, sideOffset = 4, size = 'md', ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-gray-100 bg-white py-1 text-gray-900 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        dropdownMenuContentVariants({ size }),
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    size?: DropdownMenuSize;
  }
>(({ className, inset, size = 'md', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-none font-semibold text-gray-900 outline-none transition-colors focus:bg-secondary-100 data-disabled:pointer-events-none data-disabled:opacity-50',
      dropdownMenuItemVariants({ size, inset }),
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
    size?: DropdownMenuSize;
  }
>(({ className, children, checked, size = 'md', ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-none font-semibold text-gray-900 outline-none transition-colors focus:bg-secondary-100 data-disabled:pointer-events-none data-disabled:opacity-50',
      dropdownMenuItemVariants({ size }),
      dropdownMenuSelectableItemVariants({ size }),
      className,
    )}
    checked={checked}
    {...props}
  >
    <span
      className={dropdownMenuIndicatorVariants({ size })}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
    size?: DropdownMenuSize;
  }
>(({ className, children, size = 'md', ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-none font-semibold text-gray-900 outline-none transition-colors focus:bg-secondary-100 data-disabled:pointer-events-none data-disabled:opacity-50',
      dropdownMenuItemVariants({ size }),
      dropdownMenuSelectableItemVariants({ size }),
      className,
    )}
    {...props}
  >
    <span
      className={dropdownMenuIndicatorVariants({ size })}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
    size?: DropdownMenuSize;
  }
>(({ className, inset, size = 'md', ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'font-semibold text-gray-900',
      dropdownMenuItemVariants({ size, inset }),
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('my-0 h-px bg-gray-100', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
};
