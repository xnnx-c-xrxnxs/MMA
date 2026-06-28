import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

/**
 * Storybook configuration for @old-st/ui.
 *
 * Boots a Vite-powered story sandbox that loads the same Tailwind v4 tokens
 * used by `apps/webapp` so primitives render identically to production.
 *
 * Run with:  pnpm nx run ui:storybook
 * Build:     pnpm nx run ui:build-storybook
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  /**
   * Storybook's `@storybook/react-vite` framework builds its OWN Vite config
   * and ignores any sibling `vite.config.ts` unless you merge it in here.
   * Without this hook the `@tailwindcss/vite` plugin never runs, so
   * `@import 'tailwindcss'` in `preview.css` is left as a raw CSS rule and
   * NO utility classes (`bg-card`, `border-border`, `flex`, …) are generated
   * — primitives render as unstyled DOM. Re-registering the plugin here is
   * what makes Tailwind v4 actually compile inside Storybook.
   */
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
    });
  },
};

export default config;
