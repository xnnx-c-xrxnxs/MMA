import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

export interface CloudFrontSignedUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * Generates CloudFront signed URLs for file downloads.
 * Uses an RSA key pair managed by Terraform — the private key is passed
 * as a Lambda environment variable (encrypted at rest).
 */
export class CloudFrontUrlSigner {
  constructor(
    private readonly domainName: string,
    private readonly keyPairId: string,
    private readonly privateKey: string,
    private readonly defaultExpirySeconds = 604800, // 7 days
  ) {}

  generateSignedUrl(
    fileKey: string,
    expiresInSeconds?: number,
  ): CloudFrontSignedUrlResult {
    const expiresIn = expiresInSeconds ?? this.defaultExpirySeconds;
    const url = `https://${this.domainName}/${fileKey}`;
    const dateLessThan = new Date(
      Date.now() + expiresIn * 1000,
    ).toISOString();

    const downloadUrl = getSignedUrl({
      url,
      keyPairId: this.keyPairId,
      privateKey: this.privateKey,
      dateLessThan,
    });

    return { downloadUrl, expiresIn };
  }
}
