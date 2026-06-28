/**
 * Strict config — all rules as 'error' including file-api-service.
 * Use this for projects that have a dedicated file-api-service.
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
      '@mma/no-contracts-in-use-cases': 'error',
      '@mma/no-direct-fetch-in-components': 'error',
      '@mma/no-hardcoded-status-strings': 'error',
      '@mma/enforce-service-boundary': 'error',
      '@mma/no-node-env-development': 'error',
      '@mma/require-event-handler-service': 'error',
      '@mma/require-file-api-service': 'error',
    },
  },
];
