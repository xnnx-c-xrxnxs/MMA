import { FileController } from './file.controller';
import { FileApplicationService } from '../../application/services/file-application.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const mockUser: AuthenticatedUser = {
  userId: 'user-123',
  email: 'test@example.com',
};

describe('FileController', () => {
  let controller: FileController;
  let service: jest.Mocked<FileApplicationService>;

  beforeEach(() => {
    service = {
      generateUploadUrl: jest.fn(),
      generateDownloadUrl: jest.fn(),
    } as unknown as jest.Mocked<FileApplicationService>;

    controller = new FileController(service);
  });

  describe('generateUploadUrl()', () => {
    it('delegates to service with filename, contentType and actorId', () => {
      const body = { filename: 'photo.png', contentType: 'image/png' };
      controller.generateUploadUrl(mockUser, body);
      expect(service.generateUploadUrl).toHaveBeenCalledWith('photo.png', 'image/png', mockUser.userId);
    });

    it('returns the result from the service', async () => {
      const expected = {
        uploadUrl: 'https://s3.example.com/upload',
        fileKey: 'uuid/photo.png',
        expiresIn: 300,
      };
      service.generateUploadUrl.mockResolvedValue(expected);
      const result = await controller.generateUploadUrl(mockUser, {
        filename: 'photo.png',
        contentType: 'image/png',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('generateDownloadUrl()', () => {
    it('delegates to service with the file key', () => {
      controller.generateDownloadUrl('user-123', 'uuid/photo.png');
      expect(service.generateDownloadUrl).toHaveBeenCalledWith('uuid/photo.png');
    });

    it('returns the result from the service', async () => {
      const expected = {
        downloadUrl: 'https://s3.example.com/download',
        expiresIn: 3600,
      };
      service.generateDownloadUrl.mockResolvedValue(expected);
      const result = await controller.generateDownloadUrl('user-123', 'uuid/photo.png');
      expect(result).toEqual(expected);
    });
  });
});
