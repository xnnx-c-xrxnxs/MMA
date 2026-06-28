'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mma/ui';

/**
 * Global error boundary. Catches errors that escape per-segment error.tsx files
 * (including errors thrown in the root layout).
 *
 * Must be a Client Component. The body must include <html> and <body> because
 * this replaces the root layout when triggered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Please try again.
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
      </body>
    </html>
  );
}
