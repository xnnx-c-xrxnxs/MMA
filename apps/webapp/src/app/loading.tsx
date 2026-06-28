import { Skeleton } from '@old-st/ui';

/**
 * Default loading UI shown while a route segment is fetching.
 * Domain segments override this with their own loading.tsx where appropriate.
 */
export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
