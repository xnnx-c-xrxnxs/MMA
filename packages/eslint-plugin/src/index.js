/**
 * @old-st/eslint-plugin — Coding standards enforcement for Old St Labs template projects.
 *
 * 10 rules covering Clean Architecture boundaries, import hygiene, domain purity,
 * frontend patterns, and service isolation.
 *
 * 3 configs: recommended (default), strict (all rules), relaxed (gradual adoption).
 */
const plugin = {
  rules: {
    'no-bare-contracts-import': require('./rules/no-bare-contracts-import'),
    'no-domain-framework-imports': require('./rules/no-domain-framework-imports'),
    'no-prisma-client-in-domain': require('./rules/no-prisma-client-in-domain'),
    'no-contracts-in-use-cases': require('./rules/no-contracts-in-use-cases'),
    'no-direct-fetch-in-components': require('./rules/no-direct-fetch-in-components'),
    'no-hardcoded-status-strings': require('./rules/no-hardcoded-status-strings'),
    'enforce-service-boundary': require('./rules/enforce-service-boundary'),
    'no-node-env-development': require('./rules/no-node-env-development'),
    'require-event-handler-service': require('./rules/require-event-handler-service'),
    'require-file-api-service': require('./rules/require-file-api-service'),
  },
  configs: {
    recommended: require('./configs/recommended'),
    strict: require('./configs/strict'),
    relaxed: require('./configs/relaxed'),
  },
};

module.exports = plugin;
