/**
 * @fileoverview Bans importing @prisma/client outside infrastructure/repositories/ directories.
 *
 * Standard: B3, B7 — Generated Prisma client is infrastructure-only.
 * @type {import('eslint').Rule.RuleModule}
 */

const ALLOWED_PATH_SEGMENTS = [
  '/infrastructure/repositories/',
  '/infrastructure/generated/',
];

function isInAllowedPath(filename, allowedPaths) {
  const normalized = filename.replace(/\\/g, '/');
  return allowedPaths.some((segment) => normalized.includes(segment));
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing @prisma/client outside infrastructure repositories.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedPaths: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Path segments where @prisma/client imports are permitted.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noPrismaInDomain:
        "Do not import from '@prisma/client' outside infrastructure layer. Only repository implementations in infrastructure/repositories/ may use the Prisma client.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const options = context.options[0] || {};
    const allowedPaths = options.allowedPaths || ALLOWED_PATH_SEGMENTS;

    if (isInAllowedPath(filename, allowedPaths)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        if (
          source === '@prisma/client' ||
          source.startsWith('@prisma/client/')
        ) {
          context.report({
            node: node.source,
            messageId: 'noPrismaInDomain',
          });
        }
      },
    };
  },
};
