/**
 * @fileoverview Bans checking NODE_ENV === 'development' for local-vs-cloud branching.
 *
 * Standard: B8 — STAGE=local is the single source of truth for local mode.
 * @type {import('eslint').Rule.RuleModule}
 */

function isProcessEnvNodeEnv(node) {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'MemberExpression' &&
    node.object.object.type === 'Identifier' &&
    node.object.object.name === 'process' &&
    node.object.property.type === 'Identifier' &&
    node.object.property.name === 'env' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'NODE_ENV'
  );
}

function isStringLiteral(node, value) {
  return node.type === 'Literal' && node.value === value;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow NODE_ENV === 'development' checks. Use STAGE === 'local' for local detection.",
    },
    schema: [],
    messages: {
      noNodeEnvDevelopment:
        "Do not use NODE_ENV === 'development' for local-vs-cloud branching. Use STAGE === 'local' instead (§7.1 Environment Variables).",
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '==') return;

        const isNodeEnvCheck =
          (isProcessEnvNodeEnv(node.left) &&
            isStringLiteral(node.right, 'development')) ||
          (isStringLiteral(node.left, 'development') &&
            isProcessEnvNodeEnv(node.right));

        if (isNodeEnvCheck) {
          context.report({ node, messageId: 'noNodeEnvDevelopment' });
        }
      },
    };
  },
};
