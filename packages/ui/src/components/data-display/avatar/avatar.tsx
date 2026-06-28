import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand select-none',
  {
    variants: {
      size: {
        sm: 'h-7 w-7 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  /** Full name — used to derive initials when no children are provided. */
  name?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, name, children, ...props }, ref) => {
    const content = children ?? (name ? getInitials(name) : null);
    return (
      <span
        ref={ref}
        role="img"
        aria-label={name}
        className={cn(avatarVariants({ size, className }))}
        {...props}
      >
        {content}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';

export { Avatar, avatarVariants };
