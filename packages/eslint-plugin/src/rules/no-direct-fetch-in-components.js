/**
 * @fileoverview Bans direct fetch() and axios calls in webapp/mobile component files.
 *
 * Standard: D6 — All API via @old-st/client-common, never direct fetch/axios.
 * @type {import('eslint').Rule.RuleModule}
 */

const COMPONENT_PATH_SEGMENTS = ['/components/', '/app/'];

const EXCLUDED_PATH_SEGMENTS = [
  '/infrastructure/',
  '/api-clients/',
  '/client-common/',
  'node_modules',
];

function isComponentFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const isComponent = COMPONENT_PATH_SEGMENTS.some((seg) =>
    normalized.includes(seg)
  );
  const isExcluded = EXCLUDED_PATH_SEGMENTS.some((seg) =>
    normalized.includes(seg)
  );
  const isFrontend =
    normalized.includes('/webapp/') || normalized.includes('/mobile/');
  return isComponent && isFrontend && !isExcluded;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct fetch/axios calls in frontend components. Use @old-st/client-common hooks instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedFiles: {
            type: 'array',
            items: { type: 'string' },
            description:
              'File path patterns where direct fetch is permitted.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDirectFetch:
        "Do not call fetch() directly in frontend components. Use React Query hooks from '@old-st/client-common' instead.",
      noAxiosImport:
        "Do not import axios in frontend components. Use API clients from '@old-st/client-common' instead.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isComponentFile(filename)) return {};

    const options = context.options[0] || {};
    const allowedFiles = options.allowedFiles || [];
    const normalized = filename.replace(/\\/g, '/');
    if (allowedFiles.some((pattern) => normalized.includes(pattern))) return {};

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'fetch'
        ) {
          context.report({ node, messageId: 'noDirectFetch' });
        }
      },
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        if (source === 'axios' || source.startsWith('axios/')) {
          context.report({
            node: node.source,
            messageId: 'noAxiosImport',
          });
        }
      },
    };
  },
};
