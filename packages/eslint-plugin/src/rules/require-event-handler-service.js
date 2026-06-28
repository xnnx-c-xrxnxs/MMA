/**
 * @fileoverview Flags SQS/event handling logic not inside a dedicated event-handler-service.
 *
 * Standard: New — All events must be handled by a dedicated event handler service.
 * @type {import('eslint').Rule.RuleModule}
 */

const EVENT_HANDLER_INDICATORS = [
  'SQSEvent',
  'SQSHandler',
  'SqsLocalService',
  'ReceiveMessageCommand',
  'DeleteMessageCommand',
  'NormalizedSqsRecord',
];

function isEventHandlerService(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return normalized.includes('-event-handler-service/');
}

function isSharedInfrastructurePackage(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return normalized.includes('/packages/aws/') || normalized.includes('/packages/common/');
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Event handling logic (SQS consumers, event dispatchers) must live in dedicated event-handler-service apps.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          eventPatterns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Import identifiers that indicate event-handling logic.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      requireEventHandlerService:
        "Event handling code ({{identifier}}) must live in a dedicated '*-event-handler-service' app, not in an HTTP API service.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (isEventHandlerService(filename) || isSharedInfrastructurePackage(filename))
      return {};

    const normalized = filename.replace(/\\/g, '/');
    if (!normalized.includes('-api-service/')) return {};

    const options = context.options[0] || {};
    const eventPatterns = options.eventPatterns || EVENT_HANDLER_INDICATORS;
    const patternSet = new Set(eventPatterns);

    return {
      ImportDeclaration(node) {
        if (!node.specifiers) return;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier'
          ) {
            if (patternSet.has(specifier.imported.name)) {
              context.report({
                node: specifier,
                messageId: 'requireEventHandlerService',
                data: { identifier: specifier.imported.name },
              });
            }
          }
        }
      },
    };
  },
};
