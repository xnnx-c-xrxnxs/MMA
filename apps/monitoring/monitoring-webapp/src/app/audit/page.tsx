'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Audit page has been removed. Redirect to Services. */
export default function AuditPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/services'); }, [router]);
  return <p>Redirecting to Services…</p>;
}
