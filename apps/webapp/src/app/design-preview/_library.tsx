'use client';

import * as React from 'react';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  FileIcon,
} from '@mma/ui';
import { PreviewSection, PreviewCell, UnmappedItem } from './_shell';
import manifestJson from './figma-library-manifest.json';

// ────────────────────────────────────────────────────────────────────────────
// Manifest contract — matches the figma-import workflow (B.2.5 / Safety
// Guards #13/#15/#16). `_library.tsx` reads from the JSON; it never invents
// sections, slugs, or item counts.
//
// On a freshly-bootstrapped project the manifest is `[]` and this file
// renders an empty-state card. The first run of the figma-import workflow
// (.claude/commands/figma-import.md) populates the manifest and
// registers renderers in the RENDERERS map below.
// ────────────────────────────────────────────────────────────────────────────

export interface ManifestItem {
  name: string;
  type: string;
}

export interface ManifestSection {
  order: number;
  nodeId: string;
  name: string;
  slug: string;
  childCount: number;
  items: ManifestItem[];
}

const manifest = manifestJson as ManifestSection[];

/**
 * Per-item renderer registry.
 *
 * The figma-import workflow's B.2.5 step adds entries here keyed by section
 * slug. Each entry maps `ManifestItem.name` → React element. When the
 * workflow encounters an item it cannot map to a primitive, it falls through
 * to `<UnmappedItem />`.
 *
 * Example after a workflow run:
 *
 *   const RENDERERS: Record<string, Record<string, React.ReactElement>> = {
 *     buttons: {
 *       'Primary / Default': <Button>Primary</Button>,
 *       'Primary / Disabled': <Button disabled>Primary</Button>,
 *     },
 *     badges: {
 *       'Success': <Badge variant="success">Success</Badge>,
 *     },
 *   };
 */
const RENDERERS: Record<string, Record<string, React.ReactElement>> = {};

export function FullLibrary() {
  if (manifest.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon>
          <FileIcon />
        </EmptyStateIcon>
        <EmptyStateTitle>No library imported yet</EmptyStateTitle>
        <EmptyStateDescription>
          Run the <code>/figma-import</code> workflow (see{' '}
          <a
            href="https://github.com/xnnx-c-xrxnxs/mma/blob/main/.claude/commands/figma-import.md"
            className="underline"
          >
            .claude/commands/figma-import.md
          </a>
          ) to populate the design system from a Figma file. The workflow
          writes <code>figma-library-manifest.json</code> and registers
          renderers in <code>_library.tsx</code>.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  return (
    <>
      {manifest.map((section) => {
        const sectionRenderers = RENDERERS[section.slug] ?? {};
        return (
          <PreviewSection
            key={section.slug}
            id={section.slug}
            title={section.name}
            figmaNode={section.nodeId}
            expectedCount={section.items.length}
          >
            {section.items.map((item) => {
              const rendered = sectionRenderers[item.name];
              return (
                <PreviewCell key={`${section.slug}:${item.name}`} caption={item.name}>
                  {rendered ?? <UnmappedItem name={item.name} />}
                </PreviewCell>
              );
            })}
          </PreviewSection>
        );
      })}
    </>
  );
}
