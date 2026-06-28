/**
 * @fileoverview Flags direct file upload/download operations outside file-api-service.
 *
 * Standard: New — All file uploads/downloads must use the file-api-service.
 * Default: 'off' — Enable when file-api-service exists in the project.
 * @type {import('eslint').Rule.RuleModule}
 */

const DEFAULT_FILE_INDICATORS = [
  'PutObjectCommand',
  'GetObjectCommand',
  'DeleteObjectCommand',
  'S3Client',
  'Upload',
  'multer',
  'Multer',
  'FileInterceptor',
  'FilesInterceptor',
  'AnyFilesInterceptor',
];

function isFileApiService(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return (
    normalized.includes('file-api-service/') ||
    normalized.includes('/file-service/')
  );
}

function isInfrastructureOrShared(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return (
    normalized.includes('/packages/aws/') ||
    normalized.includes('/packages/common/')
  );
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'File upload/download operations (S3, multer) must be routed through the dedicated file-api-service.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          fileApiServiceName: {
            type: 'string',
            description:
              'Name of the file API service (for documentation in error messages).',
          },
          fileIndicators: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Import identifiers that indicate file operations.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      requireFileApiService:
        'Direct file operations ({{identifier}}) should be routed through the dedicated {{serviceName}}.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (isFileApiService(filename) || isInfrastructureOrShared(filename))
      return {};

    const options = context.options[0] || {};
    const serviceName = options.fileApiServiceName || 'file-api-service';
    const fileIndicators = options.fileIndicators || DEFAULT_FILE_INDICATORS;
    const indicatorSet = new Set(fileIndicators);

    return {
      ImportDeclaration(node) {
        if (!node.specifiers) return;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier'
          ) {
            if (indicatorSet.has(specifier.imported.name)) {
              context.report({
                node: specifier,
                messageId: 'requireFileApiService',
                data: { identifier: specifier.imported.name, serviceName },
              });
            }
          }
          if (specifier.type === 'ImportDefaultSpecifier') {
            const source = node.source.value;
            if (
              typeof source === 'string' &&
              (source === 'multer' || source.startsWith('multer/'))
            ) {
              context.report({
                node: specifier,
                messageId: 'requireFileApiService',
                data: { identifier: 'multer', serviceName },
              });
            }
          }
        }
      },
    };
  },
};
