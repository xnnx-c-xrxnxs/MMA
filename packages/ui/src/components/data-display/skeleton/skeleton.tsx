import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const skeletonVariants = cva('animate-pulse rounded-md bg-muted', {
  variants: {
    variant: {
      default: 'h-4 w-full',
      line: 'h-3 w-full',
      card: 'h-28 w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return <div className={cn(skeletonVariants({ variant }), className)} {...props} />;
}

export { Skeleton, skeletonVariants };
