import { Module } from '@nestjs/common';
import {
  S3FileStorage,
  createLocalS3Client,
  createAwsS3Client,
  CloudFrontUrlSigner,
} from '@mma/aws-s3';
import { FileApplicationService } from '../application/services/file-application.service';
import { FileController } from '../presentation/controllers/file.controller';

const S3_FILE_STORAGE = 'S3_FILE_STORAGE';
const CLOUDFRONT_SIGNER = 'CLOUDFRONT_SIGNER';

@Module({
  controllers: [FileController],
  providers: [
    {
      provide: S3_FILE_STORAGE,
      useFactory: () => {
        const bucketName = process.env.FILES_S3_BUCKET_NAME || 'mma-files';
        const s3Client =
          process.env.STAGE === 'local'
            ? createLocalS3Client(process.env.DEFAULT_REGION || 'eu-west-2')
            : createAwsS3Client();
        return new S3FileStorage(s3Client, bucketName);
      },
    },
    {
      provide: CLOUDFRONT_SIGNER,
      useFactory: () => {
        const domain = process.env.CLOUDFRONT_DOMAIN;
        const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
        const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY;

        if (domain && keyPairId && privateKey) {
          return new CloudFrontUrlSigner(domain, keyPairId, privateKey);
        }
        return null; // Fall back to S3 presigned URLs (local dev)
      },
    },
    {
      provide: FileApplicationService,
      useFactory: (
        s3FileStorage: S3FileStorage,
        cloudFrontSigner: CloudFrontUrlSigner | null,
      ) => {
        return new FileApplicationService(s3FileStorage, cloudFrontSigner);
      },
      inject: [S3_FILE_STORAGE, CLOUDFRONT_SIGNER],
    },
  ],
  exports: [FileApplicationService],
})
export class FileModule {}
