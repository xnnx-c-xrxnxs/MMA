'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { useAuth } from '@old-st/client-common';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// MOCK_PREVIEW bypass — lets `/migrate-page --mock` pages render without a real
// session while a backend is still being built. Effective ONLY when
// NEXT_PUBLIC_MOCK_PREVIEW=true AND STAGE=local. This guard is permanent: the
// developer toggles it via .env.local, never by editing this file. Production
// never sets the flag, and the API re-validates every request, so layout auth
// is UX, not security (Rule #23e).
const MOCK_PREVIEW =
  process.env.NEXT_PUBLIC_MOCK_PREVIEW === 'true' &&
  process.env.NEXT_PUBLIC_STAGE === 'local';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!MOCK_PREVIEW && !isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (!MOCK_PREVIEW && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!MOCK_PREVIEW && !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
