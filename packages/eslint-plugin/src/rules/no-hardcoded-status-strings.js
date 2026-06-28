/**
 * @fileoverview Bans hardcoded string literals for status/role values in domain and use-case files.
 *
 * Standard: A8 — Domain constants are single source of truth.
 * @type {import('eslint').Rule.RuleModule}
 */

const DEFAULT_STATUS_WORDS = [
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'DELETED',
  'ARCHIVED',
  'DRAFT',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'SUSPENDED',
  'VERIFIED',
  'UNVERIFIED',
  'VALIDATION_FAILED',
  'USER',
  'ADMIN',
  'SUPERADMIN',
  'MANAGER',
  'DISCONTINUED',
  'IN_STOCK',
  'OUT_OF_STOCK',
  'LOW_STOCK',
];

const DOMAIN_PATH_SEGMENTS = [
  '/domain/entities/',
  '/use-cases/',
  '/application/services/',
];

function isInDomainOrUseCaseFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  if (normalized.includes('.spec.') || normalized.includes('.test.'))
    return false;
  return DOMAIN_PATH_SEGMENTS.some((segment) => normalized.includes(segment));
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hardcoded status/role string literals in domain and use-case files.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          statusWords: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Status/role words to flag when used as string literals.',
          },
          allowed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific string values to allow (escape hatch).',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noHardcodedStatus:
        "Do not hardcode status/role string '{{value}}'. Use the corresponding domain enum constant instead.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isInDomainOrUseCaseFile(filename)) return {};

    const options = context.options[0] || {};
    const statusWords = options.statusWords || DEFAULT_STATUS_WORDS;
    const allowed = options.allowed || [];
    const statusSet = new Set(statusWords);

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const value = node.value;

        if (statusSet.has(value) && !allowed.includes(value)) {
          context.report({
            node,
            messageId: 'noHardcodedStatus',
            data: { value },
          });
        }
      },
    };
  },
};
