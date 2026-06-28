/**
 * @fileoverview Bans importing from the bare `@old-st/contracts` root.
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
        'Disallow importing from bare @old-st/contracts root. Use domain-scoped subpaths instead.',
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
        "Do not import from '@old-st/contracts' directly. Use a domain-scoped subpath: '@old-st/contracts/user', '@old-st/contracts/order', '@old-st/contracts/product', or '@old-st/contracts/common'.",
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const allowed = options.allowedBareImports || [];

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        if (source === '@old-st/contracts' && !allowed.includes(source)) {
          context.report({ node: node.source, messageId: 'noBareImport' });
        }
      },
    };
  },
};
