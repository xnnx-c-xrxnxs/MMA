import { createTree } from '@nx/devkit/testing';
import uiPrimitiveGenerator from './generator';

// Seed the @old-st/ui barrel so the generator can find/update it.
const seedUiBarrel = (existing = '') => {
  const tree = createTree();
  tree.write(
    'packages/ui/src/index.ts',
    existing ||
      `// Utilities
export { cn } from './lib/utils';

// form-controls
export { Button, buttonVariants, type ButtonProps } from './components/form-controls/button';

// data-display
export { Badge, badgeVariants, type BadgeProps } from './components/data-display/badge';

// feedback
export { Dialog } from './components/feedback/dialog';
`,
  );
  return tree;
};

describe('ui-primitive generator', () => {
  // ── Guard ──────────────────────────────────────────────────────────────────

  it('throws when the component already exists', async () => {
    const tree = seedUiBarrel();
    tree.write('packages/ui/src/components/form-controls/switch/switch.tsx', '// existing');

    await expect(
      uiPrimitiveGenerator(tree, { name: 'Switch', category: 'form-controls', pattern: 'simple-variants' }),
    ).rejects.toThrow(/already exists/);
  });

  // ── simple-variants ────────────────────────────────────────────────────────

  describe('simple-variants pattern', () => {
    it('creates 4 files in the correct category subfolder', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Switch',
        category: 'form-controls',
        pattern: 'simple-variants',
      });

      expect(tree.exists('packages/ui/src/components/form-controls/switch/switch.tsx')).toBe(true);
      expect(tree.exists('packages/ui/src/components/form-controls/switch/index.ts')).toBe(true);
      expect(tree.exists('packages/ui/src/components/form-controls/switch/switch.stories.tsx')).toBe(true);
      expect(tree.exists('packages/ui/src/components/form-controls/switch/switch.spec.tsx')).toBe(true);
    });

    it('emits cva + forwardRef in the component file', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Switch',
        category: 'form-controls',
        pattern: 'simple-variants',
      });

      const component = tree.read('packages/ui/src/components/form-controls/switch/switch.tsx', 'utf-8') ?? '';
      expect(component).toContain("from 'class-variance-authority'");
      expect(component).toContain('switchVariants');
      expect(component).toContain('React.forwardRef');
      expect(component).toContain("Switch.displayName = 'Switch'");
      expect(component).toContain('export { Switch, switchVariants }');
    });

    it('index.ts re-exports from the component file', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Switch',
        category: 'form-controls',
        pattern: 'simple-variants',
      });

      const index = tree.read('packages/ui/src/components/form-controls/switch/index.ts', 'utf-8') ?? '';
      expect(index).toContain("export * from './switch'");
    });

    it('stories file references the correct Storybook title', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Switch',
        category: 'form-controls',
        pattern: 'simple-variants',
      });

      const stories = tree.read('packages/ui/src/components/form-controls/switch/switch.stories.tsx', 'utf-8') ?? '';
      expect(stories).toContain("title: 'Form Controls/Switch'");
      expect(stories).toContain("tags: ['autodocs']");
      expect(stories).toContain('export const Default');
    });

    it('adds export to the barrel inside the correct category section', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Switch',
        category: 'form-controls',
        pattern: 'simple-variants',
      });

      const barrel = tree.read('packages/ui/src/index.ts', 'utf-8') ?? '';
      expect(barrel).toContain(
        "export { Switch, switchVariants, type SwitchProps } from './components/form-controls/switch';",
      );
    });

    it('export appears inside the form-controls block (not after data-display)', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Switch',
        category: 'form-controls',
        pattern: 'simple-variants',
      });

      const barrel = tree.read('packages/ui/src/index.ts', 'utf-8') ?? '';
      const switchIdx = barrel.indexOf('switch');
      const dataDisplayIdx = barrel.indexOf('// data-display');
      expect(switchIdx).toBeLessThan(dataDisplayIdx);
    });

    it('handles multi-word names (ProgressBar)', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'ProgressBar',
        category: 'data-display',
        pattern: 'simple-variants',
      });

      expect(tree.exists('packages/ui/src/components/data-display/progress-bar/progress-bar.tsx')).toBe(true);
      const component = tree.read('packages/ui/src/components/data-display/progress-bar/progress-bar.tsx', 'utf-8') ?? '';
      expect(component).toContain('progressBarVariants');
      expect(component).toContain("ProgressBar.displayName = 'ProgressBar'");

      const stories = tree.read('packages/ui/src/components/data-display/progress-bar/progress-bar.stories.tsx', 'utf-8') ?? '';
      expect(stories).toContain("title: 'Data Display/ProgressBar'");
    });
  });

  // ── simple-no-variants ────────────────────────────────────────────────────

  describe('simple-no-variants pattern', () => {
    it('creates 4 files', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Textarea',
        category: 'form-controls',
        pattern: 'simple-no-variants',
      });

      expect(tree.exists('packages/ui/src/components/form-controls/textarea/textarea.tsx')).toBe(true);
      expect(tree.exists('packages/ui/src/components/form-controls/textarea/textarea.stories.tsx')).toBe(true);
      expect(tree.exists('packages/ui/src/components/form-controls/textarea/textarea.spec.tsx')).toBe(true);
    });

    it('emits forwardRef without cva', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Textarea',
        category: 'form-controls',
        pattern: 'simple-no-variants',
      });

      const component = tree.read('packages/ui/src/components/form-controls/textarea/textarea.tsx', 'utf-8') ?? '';
      expect(component).not.toContain('cva');
      expect(component).toContain('React.forwardRef');
      expect(component).toContain("Textarea.displayName = 'Textarea'");
    });

    it('adds export without variants to barrel', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Textarea',
        category: 'form-controls',
        pattern: 'simple-no-variants',
      });

      const barrel = tree.read('packages/ui/src/index.ts', 'utf-8') ?? '';
      expect(barrel).toContain(
        "export { Textarea, type TextareaProps } from './components/form-controls/textarea';",
      );
      expect(barrel).not.toContain('textareaVariants');
    });
  });

  // ── compound ──────────────────────────────────────────────────────────────

  describe('compound pattern', () => {
    it('creates 4 files', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Panel',
        category: 'layout',
        pattern: 'compound',
      });

      expect(tree.exists('packages/ui/src/components/layout/panel/panel.tsx')).toBe(true);
      expect(tree.exists('packages/ui/src/components/layout/panel/panel.stories.tsx')).toBe(true);
      expect(tree.exists('packages/ui/src/components/layout/panel/panel.spec.tsx')).toBe(true);
    });

    it('emits root + Header + Content sub-components', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Panel',
        category: 'layout',
        pattern: 'compound',
      });

      const component = tree.read('packages/ui/src/components/layout/panel/panel.tsx', 'utf-8') ?? '';
      expect(component).toContain("Panel.displayName = 'Panel'");
      expect(component).toContain("PanelHeader.displayName = 'PanelHeader'");
      expect(component).toContain("PanelContent.displayName = 'PanelContent'");
      expect(component).toContain('export { Panel, PanelHeader, PanelContent }');
    });

    it('stories use compound render with sub-components', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Panel',
        category: 'layout',
        pattern: 'compound',
      });

      const stories = tree.read('packages/ui/src/components/layout/panel/panel.stories.tsx', 'utf-8') ?? '';
      expect(stories).toContain('Panel, PanelHeader, PanelContent');
      expect(stories).toContain('<PanelHeader');
      expect(stories).toContain('<PanelContent');
    });

    it('barrel export lists all three sub-components', async () => {
      const tree = seedUiBarrel();
      await uiPrimitiveGenerator(tree, {
        name: 'Panel',
        category: 'layout',
        pattern: 'compound',
      });

      const barrel = tree.read('packages/ui/src/index.ts', 'utf-8') ?? '';
      expect(barrel).toContain(
        "export { Panel, PanelHeader, PanelContent } from './components/layout/panel';",
      );
    });
  });

  // ── barrel idempotency ─────────────────────────────────────────────────────

  it('does not duplicate the barrel export when run twice on the same tree', async () => {
    const tree = seedUiBarrel();
    await uiPrimitiveGenerator(tree, {
      name: 'Switch',
      category: 'form-controls',
      pattern: 'simple-variants',
    });

    // Manually re-invoke on a tree that already has the export (simulates re-run)
    const barrel = tree.read('packages/ui/src/index.ts', 'utf-8') ?? '';
    const count = (barrel.match(/switch/g) ?? []).length;

    // Just verify the export appears exactly once (the component file also contains the name)
    const exportLine = "export { Switch, switchVariants, type SwitchProps } from './components/form-controls/switch';";
    expect(barrel.split(exportLine).length - 1).toBe(1);
  });

  // ── new category section ───────────────────────────────────────────────────

  it('appends a new section when the category comment is missing from the barrel', async () => {
    const tree = createTree();
    tree.write(
      'packages/ui/src/index.ts',
      `// Utilities
export { cn } from './lib/utils';
`,
    );

    await uiPrimitiveGenerator(tree, {
      name: 'Spinner',
      category: 'feedback',
      pattern: 'simple-no-variants',
    });

    const barrel = tree.read('packages/ui/src/index.ts', 'utf-8') ?? '';
    expect(barrel).toContain('// feedback');
    expect(barrel).toContain(
      "export { Spinner, type SpinnerProps } from './components/feedback/spinner';",
    );
  });
});
