/**
 * @fileoverview Bans importing from @mma/contracts/* inside use-case files.
 *
 * Standard: B4 — Use cases must accept primitive types as input — no DTOs, no Zod types.
 * @type {import('eslint').Rule.RuleModule}
 */

function isUseCaseFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return (
    normalized.includes('/use-cases/') ||
    normalized.includes('/application/use-cases/')
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing contracts in use-case files. Use cases must use primitive input types.',
    },
    schema: [],
    messages: {
      noContractsInUseCases:
        "Use cases must not import from '@mma/contracts'. Use case input types should use only primitive types. DTO transformation belongs in the Application Service layer.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isUseCaseFile(filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        if (source.startsWith('@mma/contracts')) {
          context.report({
            node: node.source,
            messageId: 'noContractsInUseCases',
          });
        }
      },
    };
  },
};
