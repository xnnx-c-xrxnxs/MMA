import { notFound } from 'next/navigation';
import { PreviewShell } from './_shell';
import { FullLibrary } from './_library';

/**
 * /design-preview — runtime visual mirror of the Figma library frame.
 *
 * Gated on NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW so the route 404s in
 * production deploys unless explicitly enabled. Locally and in E2E the
 * variable defaults to "1" via .env.local / playwright.config.ts.
 */
export default function DesignPreviewPage() {
  const enabled =
    process.env.NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW === '1' ||
    process.env.NODE_ENV !== 'production';
  if (!enabled) {
    notFound();
  }
  return (
    <PreviewShell title="Design Preview · Old St Time Tracker">
      <FullLibrary />
    </PreviewShell>
  );
}
