'use client';

import { useCallback, useState } from 'react';
import { fileApiClient } from '../infrastructure/api-clients/file-api.client';

export type FileUploadStatus = 'idle' | 'requesting' | 'uploading' | 'success' | 'error';

export interface UseFileUploadResult {
  /** Upload a single file. Resolves to the S3 fileKey on success. */
  upload: (file: File) => Promise<string>;
  status: FileUploadStatus;
  /** Upload progress in 0..100 (only meaningful during 'uploading'). */
  progress: number;
  error: Error | null;
  reset: () => void;
}

/**
 * Two-step direct-to-S3 upload:
 *  1. POST /api/files/presigned-upload → { uploadUrl, fileKey }
 *  2. PUT file bytes to S3 with progress events (XMLHttpRequest).
 *
 * The backend never receives the file bytes — only the metadata. Store the
 * returned `fileKey` on the domain entity. Use `fileApiClient.presignedDownload`
 * to obtain a temporary GET URL when displaying the file.
 *
 * @example
 * const { upload, status, progress } = useFileUpload();
 * const onChange = async (e) => {
 *   const file = e.target.files?.[0];
 *   if (!file) return;
 *   const key = await upload(file);
 *   form.setValue('avatarKey', key);
 * };
 */
export function useFileUpload(): UseFileUploadResult {
  const [status, setStatus] = useState<FileUploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(async (file: File): Promise<string> => {
    setError(null);
    setProgress(0);
    setStatus('requesting');

    try {
      const { uploadUrl, fileKey } = await fileApiClient.presignedUpload(
        file.name,
        file.type || 'application/octet-stream',
      );

      setStatus('uploading');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader(
          'Content-Type',
          file.type || 'application/octet-stream',
        );

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during S3 upload'));
        xhr.onabort = () => reject(new Error('S3 upload aborted'));

        xhr.send(file);
      });

      setStatus('success');
      setProgress(100);
      return fileKey;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setStatus('error');
      throw e;
    }
  }, []);

  return { upload, status, progress, error, reset };
}
