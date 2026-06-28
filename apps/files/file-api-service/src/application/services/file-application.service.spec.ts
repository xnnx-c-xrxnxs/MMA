import { FileApplicationService } from './file-application.service';
import {
  S3FileStorage,
  PresignedUploadResult,
  PresignedDownloadResult,
  CloudFrontUrlSigner,
} from '@old-st/aws-s3';

function createMockS3FileStorage(
  overrides: Partial<S3FileStorage> = {},
): S3FileStorage {
  return {
    generateUploadUrl: jest.fn(),
    generateDownloadUrl: jest.fn(),
    ...overrides,
  } as unknown as S3FileStorage;
}

function createMockCloudFrontSigner(): CloudFrontUrlSigner {
  return {
    generateSignedUrl: jest.fn(),
  } as unknown as CloudFrontUrlSigner;
}

describe('FileApplicationService', () => {
  let service: FileApplicationService;
  let mockS3FileStorage: S3FileStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3FileStorage = createMockS3FileStorage();
    service = new FileApplicationService(mockS3FileStorage, null);
  });

  // ── generateUploadUrl ──────────────────────────────────────────────────────

  describe('generateUploadUrl()', () => {
    it('should delegate to S3FileStorage and return the result', async () => {
      const expected: PresignedUploadResult = {
        uploadUrl: 'https://s3.example.com/upload',
        fileKey: 'uuid/my-file.png',
        expiresIn: 300,
      };
      (mockS3FileStorage.generateUploadUrl as jest.Mock).mockResolvedValue(
        expected,
      );

      const result = await service.generateUploadUrl('my-file.png', 'image/png', 'actor-123');

      expect(mockS3FileStorage.generateUploadUrl).toHaveBeenCalledWith(
        'my-file.png',
        'image/png',
      );
      expect(result).toEqual(expected);
    });
  });

  // ── generateDownloadUrl ────────────────────────────────────────────────────

  describe('generateDownloadUrl()', () => {
    it('should delegate to S3FileStorage when no CloudFront signer is configured', async () => {
      const expected: PresignedDownloadResult = {
        downloadUrl: 'https://s3.example.com/download',
        expiresIn: 3600,
      };
      (mockS3FileStorage.generateDownloadUrl as jest.Mock).mockResolvedValue(
        expected,
      );

      const result = await service.generateDownloadUrl('uuid/my-file.png');

      expect(mockS3FileStorage.generateDownloadUrl).toHaveBeenCalledWith(
        'uuid/my-file.png',
      );
      expect(result).toEqual(expected);
    });

    it('should use CloudFront signer when configured', async () => {
      const mockCfSigner = createMockCloudFrontSigner();
      const cfService = new FileApplicationService(mockS3FileStorage, mockCfSigner);

      const expected: PresignedDownloadResult = {
        downloadUrl: 'https://d123.cloudfront.net/uuid/my-file.png?...',
        expiresIn: 604800,
      };
      (mockCfSigner.generateSignedUrl as jest.Mock).mockReturnValue(expected);

      const result = await cfService.generateDownloadUrl('uuid/my-file.png');

      expect(mockCfSigner.generateSignedUrl).toHaveBeenCalledWith('uuid/my-file.png');
      expect(mockS3FileStorage.generateDownloadUrl).not.toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });
});
