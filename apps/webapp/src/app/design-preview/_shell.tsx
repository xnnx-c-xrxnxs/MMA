'use client';

import * as React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '../../components/theme-toggle';

/**
 * /design-preview shell — non-interactive scaffold for the data-driven library.
 *
 * - <PreviewShell>      page chrome + ThemeToggle.
 * - <PreviewSection>    one section per Figma library entry. Forwards the
 *                       data-section-id + data-section-expected-count attrs
 *                       so Gate 0 (library-parity.spec.ts) can read them.
 * - <PreviewCell>       optional wrapper for a single cell with caption.
 *                       Renderers are NOT required to use this — the only
 *                       hard requirement is `data-section-item` on each
 *                       cell's outermost element so the parity gate counts.
 */

export interface PreviewShellProps {
  title?: string;
  children: React.ReactNode;
}

export function PreviewShell({ title = 'Design Preview', children }: PreviewShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-base font-semibold">
            <Link href="/design-preview">{title}</Link>
          </h1>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

export interface PreviewSectionProps {
  /** Slug from `figma-library-manifest.json` (e.g. `02-button`). */
  id: string;
  /** Verbatim Figma section name (e.g. `02 · Button`). */
  title: string;
  /** Source Figma node ID (e.g. `10:52`). */
  figmaNode: string;
  /** Number of items the manifest says this section must contain. */
  expectedCount: number;
  children: React.ReactNode;
}

export function PreviewSection({
  id,
  title,
  figmaNode,
  expectedCount,
  children,
}: PreviewSectionProps) {
  return (
    <section
      id={id}
      data-section-id={id}
      data-section-expected-count={expectedCount}
      className="mb-12 scroll-mt-20"
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">
          Figma node {figmaNode} · {expectedCount} item{expectedCount === 1 ? '' : 's'}
        </p>
      </header>
      <div className="rounded-lg border border-border bg-card p-6">{children}</div>
    </section>
  );
}

export interface PreviewCellProps {
  caption?: string;
  children: React.ReactNode;
}

/**
 * Optional helper. Renderers can also stamp `data-section-item` directly
 * on whatever wrapper they prefer.
 */
export function PreviewCell({ caption, children }: PreviewCellProps) {
  return (
    <div data-section-item className="flex flex-col items-start gap-2">
      <div className="flex w-full items-center justify-center">{children}</div>
      {caption ? (
        <span className="text-xs text-muted-foreground">{caption}</span>
      ) : null}
    </div>
  );
}

export function UnmappedItem({ name }: { name: string }) {
  return (
    <div
      data-section-item
      className="flex items-center justify-center rounded-md border border-dashed border-warning-text bg-warning-bg p-3 text-xs text-warning-text"
    >
      Unmapped: {name}
    </div>
  );
}
