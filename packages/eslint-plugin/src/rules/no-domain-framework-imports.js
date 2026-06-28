/**
 * @fileoverview Bans framework imports inside domain layer files.
 * Domain entities and constants must remain pure TypeScript with zero external dependencies.
 *
 * Standard: A5, A7, B6 — Domain layer has zero dependencies on contracts, NestJS, or frameworks.
 * @type {import('eslint').Rule.RuleModule}
 */

const DEFAULT_BANNED_PACKAGES = [
  '@nestjs/',
  '@mma/contracts',
  'zod',
  'express',
  '@aws-sdk/',
  'aws-sdk',
  'rxjs',
];

const DOMAIN_PATH_SEGMENTS = [
  '/domain/entities/',
  '/domain/constants/',
  '/domain/exceptions/',
];

function isInDomainLayer(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return DOMAIN_PATH_SEGMENTS.some((segment) => normalized.includes(segment));
}

function matchesBannedPackage(source, bannedPackages) {
  return bannedPackages.find((banned) => {
    if (banned.endsWith('/')) {
      return source.startsWith(banned);
    }
    return source === banned || source.startsWith(banned + '/');
  });
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow framework and infrastructure imports inside domain layer files.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          bannedPackages: {
            type: 'array',
            items: { type: 'string' },
            description:
              'List of package prefixes to ban in domain layer. Trailing / matches any sub-import.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noFrameworkImport:
        "Domain layer must not import from '{{source}}'. Domain entities, constants, and exceptions must be pure TypeScript with zero framework dependencies.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isInDomainLayer(filename)) return {};

    const options = context.options[0] || {};
    const bannedPackages = options.bannedPackages || DEFAULT_BANNED_PACKAGES;

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        const matched = matchesBannedPackage(source, bannedPackages);
        if (matched) {
          context.report({
            node: node.source,
            messageId: 'noFrameworkImport',
            data: { source },
          });
        }
      },
    };
  },
};
