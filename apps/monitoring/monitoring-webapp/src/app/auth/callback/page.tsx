'use client';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useAuth } from '../../../lib/auth-provider';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setToken } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      router.push('/');
    }
  }, [searchParams, setToken, router]);

  return <p>Signing you in…</p>;
}

// GitHub OAuth callback — ?token=... is set by monitoring-api-service redirect
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CallbackHandler />
    </Suspense>
  );
}
