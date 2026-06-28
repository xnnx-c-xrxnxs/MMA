/**
 * @fileoverview Bans importing from the bare `@mma/contracts` root.
 * All contract imports must use domain-scoped subpaths.
 *
 * Standard: A11, B1 — Prevents transitive type coupling between domains.
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing from bare @mma/contracts root. Use domain-scoped subpaths instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedBareImports: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of bare import paths to allow (escape hatch).',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noBareImport:
        "Do not import from '@mma/contracts' directly. Use a domain-scoped subpath: '@mma/contracts/user', '@mma/contracts/order', '@mma/contracts/product', or '@mma/contracts/common'.",
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const allowed = options.allowedBareImports || [];

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        if (source === '@mma/contracts' && !allowed.includes(source)) {
          context.report({ node: node.source, messageId: 'noBareImport' });
        }
      },
    };
  },
};
