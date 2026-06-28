import * as React from 'react';
import { cn } from '../../../lib/utils';

const EmptyState = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-12 text-center',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
EmptyState.displayName = 'EmptyState';

const EmptyStateIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-brand',
        className,
      )}
      {...props}
    />
  ),
);
EmptyStateIcon.displayName = 'EmptyStateIcon';

const EmptyStateTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
  ),
);
EmptyStateTitle.displayName = 'EmptyStateTitle';

const EmptyStateDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('max-w-sm text-sm text-muted-foreground', className)}
    {...props}
  />
));
EmptyStateDescription.displayName = 'EmptyStateDescription';

const EmptyStateAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-2', className)} {...props} />
  ),
);
EmptyStateAction.displayName = 'EmptyStateAction';

export {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateAction,
};
