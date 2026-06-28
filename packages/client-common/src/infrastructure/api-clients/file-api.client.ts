import { apiRequest } from './base-api.client';
import { z } from 'zod';
import { getApiConfig } from '../config';

const baseUrl = () => getApiConfig().fileApiUrl;

const presignedUploadResponseSchema = z.object({
  uploadUrl: z.string(),
  fileKey: z.string(),
  expiresIn: z.number(),
});

const presignedDownloadResponseSchema = z.object({
  downloadUrl: z.string(),
  expiresIn: z.number(),
});

export type PresignedUploadResponse = z.infer<typeof presignedUploadResponseSchema>;
export type PresignedDownloadResponse = z.infer<typeof presignedDownloadResponseSchema>;

export const fileApiClient = {
  /**
   * Request a presigned PUT URL for uploading a file directly to S3.
   * The backend never sees the file bytes — the browser PUTs to S3 itself.
   */
  presignedUpload(filename: string, contentType: string): Promise<PresignedUploadResponse> {
    return apiRequest(baseUrl(), '/files/presigned-upload', {
      method: 'POST',
      body: { filename, contentType },
      schema: presignedUploadResponseSchema,
    });
  },

  /** Request a presigned GET URL for downloading a file from S3. */
  presignedDownload(fileKey: string): Promise<PresignedDownloadResponse> {
    return apiRequest(
      baseUrl(),
      `/files/presigned-download/${encodeURIComponent(fileKey)}`,
      {
        method: 'GET',
        schema: presignedDownloadResponseSchema,
      },
    );
  },
};
