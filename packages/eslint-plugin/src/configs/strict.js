/**
 * Strict config — all rules as 'error' including file-api-service.
 * Use this for projects that have a dedicated file-api-service.
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
      '@old-st/no-contracts-in-use-cases': 'error',
      '@old-st/no-direct-fetch-in-components': 'error',
      '@old-st/no-hardcoded-status-strings': 'error',
      '@old-st/enforce-service-boundary': 'error',
      '@old-st/no-node-env-development': 'error',
      '@old-st/require-event-handler-service': 'error',
      '@old-st/require-file-api-service': 'error',
    },
  },
];
