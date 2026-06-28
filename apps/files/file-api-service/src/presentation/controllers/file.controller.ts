import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import { createLogger } from '@old-st/telemetry';
import { FileApplicationService } from '../../application/services/file-application.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../decorators/current-user.decorator';

const logger = createLogger('file-api-service');

const presignedUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
});

type PresignedUploadInput = z.infer<typeof presignedUploadSchema>;

// NOTE: Every @Body / @Query / @Param MUST have a matching @ApiBody / @ApiQuery /
// @ApiParam decorator with an explicit
// `schema: { type: 'object' as const, properties: {...}, required: [...] }` block.
// Zod-inferred types are erased at runtime, so without these decorators the
// Swagger UI "Try it out" panel shows no input fields (only the Execute button).
// Enforced by the `swagger-decorators-required` lint check in scripts/lint-standards.ts.
@ApiTags('files')
@ApiBearerAuth('JWT-auth')
@Controller('files')
export class FileController {
  constructor(
    private readonly fileApplicationService: FileApplicationService,
  ) {}

  @Post('presigned-upload')
  @UsePipes(new ZodValidationPipe(presignedUploadSchema))
  @ApiOperation({
    summary: 'Request a presigned S3 PUT URL for direct browser upload',
    description:
      'Returns a short-lived presigned URL that the browser uses to PUT file bytes directly to S3 — no file content passes through the backend. Persist the returned `fileKey` on the domain entity that owns this file.',
  })
  @ApiBody({
    description: 'Original filename and MIME content type',
    schema: {
      type: 'object' as const,
      properties: {
        filename: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          example: 'profile-avatar.png',
        },
        contentType: {
          type: 'string',
          minLength: 1,
          maxLength: 127,
          example: 'image/png',
        },
      },
      required: ['filename', 'contentType'],
    },
  })
  @ApiCreatedResponse({
    description: 'Presigned upload URL created.',
    schema: {
      type: 'object' as const,
      properties: {
        uploadUrl: {
          type: 'string',
          format: 'uri',
          description: 'Send a PUT request with the file bytes to this URL.',
        },
        fileKey: {
          type: 'string',
          description: 'S3 object key — persist this on the domain entity.',
          example: 'uploads/2025/01/abc-123-profile-avatar.png',
        },
        expiresIn: {
          type: 'number',
          description: 'Seconds until the upload URL expires.',
          example: 900,
        },
      },
      required: ['uploadUrl', 'fileKey', 'expiresIn'],
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error (missing or invalid fields).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async generateUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PresignedUploadInput,
  ) {
    logger.info('Generating presigned upload URL', {
      userId: user.userId,
      filename: body.filename,
      contentType: body.contentType,
    });
    return this.fileApplicationService.generateUploadUrl(
      body.filename,
      body.contentType,
      user.userId,
    );
  }

  @Get('presigned-download/:key')
  @ApiOperation({
    summary: 'Request a presigned S3 GET URL for downloading a stored file',
    description:
      'Returns a short-lived presigned URL the client can use to download the file directly from S3. The `key` is the value persisted on the domain entity when the file was uploaded.',
  })
  @ApiParam({
    name: 'key',
    description: 'S3 object key returned by /presigned-upload.',
    required: true,
    example: 'uploads/2025/01/abc-123-profile-avatar.png',
  })
  @ApiOkResponse({
    description: 'Presigned download URL issued.',
    schema: {
      type: 'object' as const,
      properties: {
        downloadUrl: { type: 'string', format: 'uri' },
        expiresIn: { type: 'number', example: 900 },
      },
      required: ['downloadUrl', 'expiresIn'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async generateDownloadUrl(
    @CurrentUser('userId') userId: string,
    @Param('key') key: string,
  ) {
    logger.info('Generating presigned download URL', { userId, key });
    return this.fileApplicationService.generateDownloadUrl(key);
  }
}
