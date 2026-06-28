import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../../lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border border-gray-100 bg-card text-card-foreground', className)} {...props} />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-foreground text-base font-extrabold leading-5 tracking-normal', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const cardKeycapVariants = cva(
  'inline-flex min-w-8 items-center justify-center rounded-sm border px-2 py-0.5 text-sm font-semibold leading-5',
  {
    variants: {
      tone: {
        default: 'border-input bg-background text-foreground',
        info: 'border-secondary-200 bg-secondary-50 text-secondary-800',
        success: 'border-success-text/20 bg-success-bg text-success-text',
        danger: 'border-danger-text/20 bg-danger-bg text-danger-text',
        warning: 'border-warning-text/20 bg-warning-bg text-warning-text',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);

const CardIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-sm bg-secondary text-secondary-700',
        className,
      )}
      {...props}
    />
  ),
);
CardIcon.displayName = 'CardIcon';

const CardSection = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section ref={ref} className={cn(' border-gray-100 p-4 first:border-t-0', className)} {...props} />
  ),
);
CardSection.displayName = 'CardSection';

interface CardRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

const CardRow = React.forwardRef<HTMLDivElement, CardRowProps>(
  ({ className, label, value, icon, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center justify-between gap-4 text-sm', className)} {...props}>
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        {icon ? <span className="inline-flex items-center text-base leading-none">{icon}</span> : null}
        <span>{label}</span>
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  ),
);
CardRow.displayName = 'CardRow';

interface CardShortcutRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  keys: React.ReactNode;
}

const CardShortcutRow = React.forwardRef<HTMLDivElement, CardShortcutRowProps>(
  ({ className, label, keys, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center justify-between gap-4 text-sm', className)} {...props}>
      <span className="text-muted-foreground">{label}</span>
      <div className="inline-flex items-center gap-1.5">{keys}</div>
    </div>
  ),
);
CardShortcutRow.displayName = 'CardShortcutRow';

interface CardKeycapProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
  VariantProps<typeof cardKeycapVariants> { }

const CardKeycap = React.forwardRef<HTMLSpanElement, CardKeycapProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(cardKeycapVariants({ tone }), className)} {...props} />
  ),
);
CardKeycap.displayName = 'CardKeycap';

const CardAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex w-full items-center justify-center rounded-md bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
CardAction.displayName = 'CardAction';

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardIcon,
  CardKeycap,
  cardKeycapVariants,
  CardRow,
  CardSection,
  CardShortcutRow,
  CardTitle,
  type CardKeycapProps
};
