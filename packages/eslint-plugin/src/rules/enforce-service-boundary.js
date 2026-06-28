/**
 * @fileoverview Enforces that controllers only import from application/services layer.
 *
 * Standard: A1 — Controllers never call use-cases directly.
 * @type {import('eslint').Rule.RuleModule}
 */

function isControllerFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return normalized.includes('/presentation/controllers/');
}

const BANNED_LAYER_SEGMENTS = [
  '/use-cases/',
  '/domain/entities/',
  '/domain/exceptions/',
  '/infrastructure/repositories/',
];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Controllers must only import from application/services layer. Never import use cases, domain entities, or repositories directly.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          layerMap: {
            type: 'object',
            description:
              'Map of source layer patterns to allowed import layer patterns.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDirectLayerAccess:
        "Controllers must not import from '{{source}}'. Route through the Application Service instead. Controllers → Application Services → Use Cases (Golden Rule #1).",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isControllerFile(filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        const normalizedSource = source.replace(/\\/g, '/');
        const isBannedLayer = BANNED_LAYER_SEGMENTS.some((seg) =>
          normalizedSource.includes(seg)
        );

        if (isBannedLayer) {
          context.report({
            node: node.source,
            messageId: 'noDirectLayerAccess',
            data: { source },
          });
        }
      },
    };
  },
};
