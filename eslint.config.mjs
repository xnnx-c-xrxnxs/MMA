import nx from '@nx/eslint-plugin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const oldStPlugin = require('./packages/eslint-plugin/src/index.js');

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/generated/**', '**/.next'],
  },
  // Old St Labs coding standards plugin
  {
    plugins: {
      '@old-st': oldStPlugin,
    },
    rules: {
      '@old-st/no-bare-contracts-import': 'error',
      '@old-st/no-domain-framework-imports': 'error',
      '@old-st/no-prisma-client-in-domain': 'error',
      '@old-st/no-contracts-in-use-cases': 'error',
      '@old-st/no-direct-fetch-in-components': 'error',
      '@old-st/no-hardcoded-status-strings': 'error',
      '@old-st/enforce-service-boundary': 'error',
      '@old-st/no-node-env-development': 'error',
      '@old-st/require-event-handler-service': 'error',
      '@old-st/require-file-api-service': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:user',
              onlyDependOnLibsWithTags: ['scope:user', 'scope:shared', 'type:contracts'],
            },
            {
              sourceTag: 'scope:product',
              onlyDependOnLibsWithTags: ['scope:product', 'scope:shared', 'type:contracts'],
            },
            {
              sourceTag: 'scope:order',
              onlyDependOnLibsWithTags: ['scope:order', 'scope:shared', 'type:contracts'],
            },
            {
              sourceTag: 'scope:frontend',
              onlyDependOnLibsWithTags: [
                'scope:shared',
                'scope:frontend',
                'scope:user',
                'scope:order',
                'scope:product',
                'type:contracts',
              ],
            },
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: ['scope:auth', 'scope:shared', 'type:contracts'],
            },
            {
              sourceTag: 'scope:files',
              onlyDependOnLibsWithTags: ['scope:files', 'scope:shared', 'type:contracts'],
            },
            {
              sourceTag: 'scope:e2e',
              onlyDependOnLibsWithTags: ['scope:shared', 'type:e2e-support'],
            },
            {
              sourceTag: 'scope:monitoring',
              onlyDependOnLibsWithTags: ['scope:monitoring', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared', 'type:contracts'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
