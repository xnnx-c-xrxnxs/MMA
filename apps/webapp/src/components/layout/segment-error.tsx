'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mma/ui';

interface SegmentErrorProps {
  /** Page title shown in the error card. */
  title: string;
  /** The error caught by the segment boundary. */
  error: Error & { digest?: string };
  /** React's reset callback — re-renders the segment. */
  reset: () => void;
}

/**
 * Reusable error UI for App Router per-segment error.tsx files.
 * Each domain segment wraps this with its own copy in case it needs
 * to render extra context (e.g. a back-to-list link).
 */
export function SegmentError({ title, error, reset }: SegmentErrorProps) {
  useEffect(() => {
    console.error(`[${title}] segment error`, error);
  }, [error, title]);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Failed to load {title.toLowerCase()}</CardTitle>
          <CardDescription>
            {error.message || 'Something went wrong while rendering this page.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Error ID: <code>{error.digest}</code>
            </p>
          )}
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
