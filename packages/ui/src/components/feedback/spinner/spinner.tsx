import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const spinnerVariants = cva('animate-spin text-muted-foreground', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-10 w-10',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface SpinnerProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'>,
    VariantProps<typeof spinnerVariants> {
  /** Accessible label — defaults to "Loading". */
  label?: string;
}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size, label = 'Loading', ...props }, ref) => (
    <svg
      ref={ref}
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  ),
);
Spinner.displayName = 'Spinner';

export { Spinner, spinnerVariants };
