'use client';

import { SegmentError } from '@/components/layout/segment-error';

export default function ProductsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError title="Products" {...props} />;
}
