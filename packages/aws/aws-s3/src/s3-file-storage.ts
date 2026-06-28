import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * S3FileStorage — Generates presigned URLs for browser-based file uploads and downloads.
 *
 * File keys are prefixed with a UUID to prevent collisions.
 * The S3 bucket and client are injected at construction time.
 */
export class S3FileStorage {
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucketName: string,
    private readonly uploadExpirySeconds = 300,
    private readonly downloadExpirySeconds = 3600,
  ) {}

  /**
   * Generate a presigned PUT URL for uploading a file.
   *
   * @param filename - Original filename (sanitized and prefixed with UUID)
   * @param contentType - MIME type constraint for the upload
   * @returns Presigned upload URL + the generated file key
   */
  async generateUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<PresignedUploadResult> {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = `${randomUUID()}/${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.uploadExpirySeconds,
    });

    return {
      uploadUrl,
      fileKey,
      expiresIn: this.uploadExpirySeconds,
    };
  }

  /**
   * Generate a presigned GET URL for downloading a file.
   *
   * @param fileKey - The S3 object key (returned by generateUploadUrl)
   * @returns Presigned download URL
   */
  async generateDownloadUrl(
    fileKey: string,
  ): Promise<PresignedDownloadResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.downloadExpirySeconds,
    });

    return {
      downloadUrl,
      expiresIn: this.downloadExpirySeconds,
    };
  }
}
