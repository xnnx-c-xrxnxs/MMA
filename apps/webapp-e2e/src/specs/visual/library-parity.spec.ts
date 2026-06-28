import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ManifestItem {
  name: string;
  type: string;
}
interface ManifestSection {
  order: number;
  nodeId: string;
  name: string;
  slug: string;
  childCount: number;
  items: ManifestItem[];
}

// Loaded at runtime (not via TS import) to avoid crossing Nx project boundaries.
const manifestPath = resolve(
  __dirname,
  '../../../../webapp/src/app/design-preview/figma-library-manifest.json',
);
const sections = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestSection[];

/**
 * Gate 0 — kills the #1 design-preview failure mode (the figma-import command).
 *
 * Asserts that /design-preview matches `figma-library-manifest.json` exactly:
 * - same number of sections, in manifest order
 * - same `[data-section-id]` slug per section
 * - same `[data-section-item]` count per section
 *
 * If this fails, _library.tsx is wrong — never edit the manifest to match.
 */
test.describe('@library-parity design-preview library parity', () => {
  // On a freshly-bootstrapped project the manifest is `[]`. Skip Gate 0
  // entirely until the figma-import workflow populates the library.
  test.skip(sections.length === 0, 'No library imported yet — manifest is empty.');

  test('renders every section from figma-library-manifest.json in order', async ({ page }) => {
    await page.goto('/design-preview');
    await page.waitForSelector('[data-section-id]');

    const renderedSlugs = await page
      .locator('[data-section-id]')
      .evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLElement).getAttribute('data-section-id')),
      );

    expect(
      renderedSlugs,
      'design-preview sections drifted from figma-library-manifest.json',
    ).toEqual(sections.map((s) => s.slug));
  });

  for (const section of sections) {
    test(`section "${section.name}" renders ${section.items.length} cells`, async ({ page }) => {
      await page.goto('/design-preview');
      const cellCount = await page
        .locator(`[data-section-id="${section.slug}"] [data-section-item]`)
        .count();
      expect(
        cellCount,
        `Section "${section.name}" (${section.slug}): expected ${section.items.length} cells, got ${cellCount}`,
      ).toBe(section.items.length);
    });
  }

  test('each rendered section advertises the manifest count via data-section-expected-count', async ({
    page,
  }) => {
    await page.goto('/design-preview');
    for (const section of sections) {
      const advertised = await page
        .locator(`[data-section-id="${section.slug}"]`)
        .first()
        .getAttribute('data-section-expected-count');
      expect(
        Number(advertised),
        `Section "${section.name}" advertises wrong expected count`,
      ).toBe(section.items.length);
    }
  });
});
