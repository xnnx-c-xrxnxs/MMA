import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@old-st/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>404 — Not found</CardTitle>
          <CardDescription>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button>Go home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
