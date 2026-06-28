'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AlarmsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'alarms');
    router.replace(`/services?${params.toString()}`);
  }, [router, searchParams]);

  return <p>Redirecting to Services → Alarms…</p>;
}

/**
 * Alarms have been consolidated into the Services page as an inner tab.
 * This page redirects to /services?tab=alarms preserving the env query param.
 */
export default function AlarmsPage() {
  return (
    <Suspense fallback={<p>Redirecting to Services → Alarms…</p>}>
      <AlarmsRedirect />
    </Suspense>
  );
}
