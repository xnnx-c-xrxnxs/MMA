// Examples ESLint config — extends the root config.
//
// The root eslint.config.mjs defines all rules, including the @old-st coding
// standards plugin and the @nx/enforce-module-boundaries depConstraints. This
// file just re-exports it so example projects get the same lint behaviour.
//
// If example-specific overrides are ever needed, append them to the exported
// array (do NOT replace the root config).

import rootConfig from '../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    ignores: ['**/dist', '**/out-tsc', '**/generated/**', '**/.next', '**/node_modules'],
  },
];
