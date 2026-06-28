/**
 * Relaxed config — core import rules as 'error', pattern rules as 'warn'.
 * Use this for early adoption or gradual migration.
 */
module.exports = [
  {
    plugins: {
      get '@mma'() {
        return require('../index');
      },
    },
    rules: {
      '@mma/no-bare-contracts-import': 'error',
      '@mma/no-domain-framework-imports': 'error',
      '@mma/no-prisma-client-in-domain': 'error',
      '@mma/no-contracts-in-use-cases': 'warn',
      '@mma/no-direct-fetch-in-components': 'warn',
      '@mma/no-hardcoded-status-strings': 'warn',
      '@mma/enforce-service-boundary': 'warn',
      '@mma/no-node-env-development': 'error',
      '@mma/require-event-handler-service': 'warn',
      '@mma/require-file-api-service': 'off',
    },
  },
];
