import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures/base.fixture';

/**
 * Accessibility scans run with axe-core against every primary page.
 *
 * - We fail the suite on `serious` and `critical` violations only. Best-practice
 *   warnings (`minor`, `moderate`) surface as console output but don't block
 *   merges — bring those down opportunistically.
 * - Add new pages here whenever a new top-level route ships.
 * - Tag this suite with `@a11y` so it can be run in isolation:
 *   `nx e2e webapp-e2e -- --grep "@a11y"`.
 */

const PAGES_TO_SCAN: { path: string; name: string }[] = [
  { path: '/', name: 'dashboard' },
  // design-preview is a dev-only Figma inspection page — not scanned in CI.
];

test.describe('@a11y axe scans', () => {
  for (const { path, name } of PAGES_TO_SCAN) {
    test(`${name} has no critical or serious violations`, async ({ page }) => {
      await page.goto(path);
      // Wait for first heading so the table/card content has rendered.
      await page.waitForSelector('h1', { timeout: 10_000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      // Surface minor issues to console for visibility without failing.
      const advisory = results.violations.filter(
        (v) => v.impact !== 'critical' && v.impact !== 'serious',
      );
      if (advisory.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[a11y advisory] ${name}:`,
          advisory.map((v) => `${v.id} (${v.impact})`).join(', '),
        );
      }

      expect(
        blocking,
        `Critical/serious a11y violations on ${name}: ${JSON.stringify(blocking, null, 2)}`,
      ).toEqual([]);
    });
  }
});
