/**
 * Relaxed config — core import rules as 'error', pattern rules as 'warn'.
 * Use this for early adoption or gradual migration.
 */
module.exports = [
  {
    plugins: {
      get '@old-st'() {
        return require('../index');
      },
    },
    rules: {
      '@old-st/no-bare-contracts-import': 'error',
      '@old-st/no-domain-framework-imports': 'error',
      '@old-st/no-prisma-client-in-domain': 'error',
      '@old-st/no-contracts-in-use-cases': 'warn',
      '@old-st/no-direct-fetch-in-components': 'warn',
      '@old-st/no-hardcoded-status-strings': 'warn',
      '@old-st/enforce-service-boundary': 'warn',
      '@old-st/no-node-env-development': 'error',
      '@old-st/require-event-handler-service': 'warn',
      '@old-st/require-file-api-service': 'off',
    },
  },
];
