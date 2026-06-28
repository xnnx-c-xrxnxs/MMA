import { S3FileStorage, PresignedUploadResult, PresignedDownloadResult, CloudFrontUrlSigner } from '@old-st/aws-s3';
import { createLogger } from '@old-st/telemetry';

const logger = createLogger('file-api-service');

export class FileApplicationService {
  constructor(
    private readonly s3FileStorage: S3FileStorage,
    private readonly cloudFrontSigner: CloudFrontUrlSigner | null,
  ) {}

  async generateUploadUrl(
    filename: string,
    contentType: string,
    actorId: string,
  ): Promise<PresignedUploadResult> {
    logger.info('Generating presigned upload URL', { filename, contentType, actorId });
    const result = await this.s3FileStorage.generateUploadUrl(filename, contentType);
    logger.info('Presigned upload URL generated', { filename, fileKey: result.fileKey, actorId });
    return result;
  }

  async generateDownloadUrl(
    fileKey: string,
  ): Promise<PresignedDownloadResult> {
    logger.info('Generating download URL', { fileKey });

    // Use CloudFront signed URLs in deployed environments (long expiry, edge-cached).
    // Fall back to S3 presigned URLs locally (no CloudFront).
    if (this.cloudFrontSigner) {
      const result = this.cloudFrontSigner.generateSignedUrl(fileKey);
      logger.info('CloudFront signed download URL generated', { fileKey });
      return result;
    }

    const result = await this.s3FileStorage.generateDownloadUrl(fileKey);
    logger.info('S3 presigned download URL generated', { fileKey });
    return result;
  }
}
