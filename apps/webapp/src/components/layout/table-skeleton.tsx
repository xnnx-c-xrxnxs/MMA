import { Skeleton } from '@mma/ui';

interface TableSkeletonProps {
  /** Number of placeholder rows to render. */
  rows?: number;
}

/**
 * Generic table skeleton used by domain loading.tsx files
 * while their respective list queries are in flight.
 */
export function TableSkeleton({ rows = 8 }: TableSkeletonProps) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
