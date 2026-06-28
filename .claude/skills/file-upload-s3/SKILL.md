---
name: file-upload-s3
description: Implement S3-backed file upload/download across the stack. Use when modifying apps/files/file-api-service/ or integrating file uploads into domain services (e.g. an avatar fileKey).
---

# Skill: file-upload-s3

## When to use this skill

Use this skill when:
- Implementing file upload or download functionality anywhere in the stack
- Modifying `apps/files/file-api-service/`
- Integrating file uploads into domain services (e.g., storing a user avatar `fileKey`)
- Adding frontend file upload or download features (webapp or mobile)
- Reviewing S3-related code

---

## 1. Golden Rule

**All file uploads and downloads MUST go through `file-api-service`.** Domain services (user-api-service, order-api-service, etc.) must never touch S3 directly. They never import `@aws-sdk/client-s3` or `@mma/aws-s3`.

The `file-api-service` is the single gate for all S3 operations. It issues **presigned URLs** that allow the client to upload or download directly to/from S3 — no file bytes ever pass through any backend service.

---

## 2. How Presigned URLs Work

```
CLIENT                    file-api-service          S3
  │                             │                    │
  │  POST /files/presigned-upload                    │
  │ ─────────────────────────► │                    │
  │                             │  generate PUT URL  │
  │                             │ ──────────────────►│
  │  { uploadUrl, fileKey }     │                    │
  │ ◄───────────────────────── │                    │
  │                             │                    │
  │  PUT {uploadUrl} (file bytes directly to S3)     │
  │ ────────────────────────────────────────────────►│
  │                             │                    │
  │  Save fileKey in domain entity                   │
  │                             │                    │
  │  GET /files/presigned-download/:key              │
  │ ─────────────────────────► │                    │
  │                             │  generate GET URL  │
  │                             │ ──────────────────►│
  │  { downloadUrl }            │                    │
  │ ◄───────────────────────── │                    │
  │                             │                    │
  │  GET {downloadUrl} (stream directly from S3)     │
  │ ◄────────────────────────────────────────────────│
```

---

## 3. file-api-service Endpoints

### `POST /api/files/presigned-upload`

Generate a presigned PUT URL to upload a file directly to S3.

**Request body:**
```json
{
  "filename": "profile-photo.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "uploadUrl": "https://bucket.s3.amazonaws.com/...",
  "fileKey": "a1b2c3d4-e5f6.../profile-photo.jpg",
  "expiresIn": 300
}
```

The `fileKey` is what you store in the domain entity. Format: `{uuid}/{sanitized-filename}`.

### `GET /api/files/presigned-download/:key`

Generate a presigned GET URL to download a file.

**Response:**
```json
{
  "downloadUrl": "https://bucket.s3.amazonaws.com/...",
  "expiresIn": 300
}
```

Pass `:key` as the `fileKey` value stored in the domain entity (URL-encoded).

---

## 4. S3FileStorage (aws-s3 package)

The `file-api-service` delegates S3 operations to `S3FileStorage` from `@mma/aws-s3`.

```typescript
// packages/aws/aws-s3/src/s3-file-storage.ts
export class S3FileStorage {
  async generatePresignedUploadUrl(
    filename: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<{ uploadUrl: string; fileKey: string }>;

  async generatePresignedDownloadUrl(
    fileKey: string,
    expiresInSeconds?: number,
  ): Promise<{ downloadUrl: string }>;
}
```

**Local development:** LocalStack provides S3 on port 4566. The `s3-client-factory.ts` in `@mma/aws-s3` checks `STAGE=local` and points the client at `LOCALSTACK_ENDPOINT`.

You must add `s3` to the `SERVICES=` list in `docker-compose.yml` for LocalStack to activate S3:

```yaml
# docker-compose.yml
environment:
  - SERVICES=dynamodb,sqs,s3
```

---

## 5. FileApplicationService

The `FileApplicationService` in `file-api-service` is thin — it delegates directly to `S3FileStorage`:

```typescript
// apps/files/file-api-service/src/application/services/file-application.service.ts
@Injectable()
export class FileApplicationService {
  constructor(private readonly s3FileStorage: S3FileStorage) {}

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; fileKey: string; expiresIn: number }> {
    const expiresIn = 300; // 5 minutes
    const result = await this.s3FileStorage.generatePresignedUploadUrl(
      filename,
      contentType,
      expiresIn,
    );
    return { ...result, expiresIn };
  }

  async getPresignedDownloadUrl(
    fileKey: string,
  ): Promise<{ downloadUrl: string; expiresIn: number }> {
    const expiresIn = 300;
    const result = await this.s3FileStorage.generatePresignedDownloadUrl(fileKey, expiresIn);
    return { ...result, expiresIn };
  }
}
```

---

## 6. Module Wiring

```typescript
// apps/files/file-api-service/src/modules/file.module.ts
@Module({
  providers: [
    {
      provide: S3FileStorage,
      useFactory: () => {
        return new S3FileStorage(
          createS3Client(), // from @mma/aws-s3
          process.env.FILES_S3_BUCKET_NAME ?? '',
        );
      },
    },
    FileApplicationService,
  ],
  controllers: [FileController],
})
export class FileModule {}
```

Import `S3FileStorage` and `createS3Client` from `@mma/aws-s3`.

---

## 7. File Key Design

The `fileKey` returned by `generatePresignedUploadUrl` uses this format:

```
{uuid}/{sanitized-filename}
```

Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890/profile-photo.jpg`

The UUID prefix ensures uniqueness even when the same filename is uploaded multiple times. The filename is sanitized to remove special characters that could cause S3 or URL issues.

**Always store the `fileKey` in the domain entity, never the full URL.** URLs expire; keys don't.

---

## 8. Integrating Uploads in a Domain Service

When a domain entity needs to store a file (e.g., a user avatar), the flow is:

1. **Client calls `file-api-service`** to get a presigned upload URL
2. **Client uploads directly to S3** using the presigned URL
3. **Client calls the domain service** with the returned `fileKey`
4. **Domain service stores the `fileKey`** in its entity

```typescript
// Example: User with avatar
// 1. Client: POST /api/files/presigned-upload → { uploadUrl, fileKey }
// 2. Client: PUT uploadUrl (binary file)
// 3. Client: PATCH /api/users/:userId { avatarKey: fileKey }
// 4. user-api-service stores fileKey on the User entity

// In User entity:
class UserEntity {
  private _avatarKey: string | undefined;
  get avatarKey(): string | undefined { return this._avatarKey; }
  setAvatar(fileKey: string): void { this._avatarKey = fileKey; }
}
```

**The domain service never calls file-api-service or touches S3.** It only stores and returns the `fileKey` string.

---

## 9. Frontend Integration (webapp)

### Upload flow

```typescript
// In a React component or mutation:
async function uploadFile(file: File) {
  // Step 1: Get presigned URL from file-api-service
  const { uploadUrl, fileKey } = await fileApiClient.getPresignedUploadUrl({
    filename: file.name,
    contentType: file.type,
  });

  // Step 2: Upload directly to S3
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  // Step 3: Return fileKey to store in domain entity
  return fileKey;
}
```

### Download flow

```typescript
// In a React component:
async function getDownloadUrl(fileKey: string) {
  const { downloadUrl } = await fileApiClient.getPresignedDownloadUrl(fileKey);
  return downloadUrl; // Use as <img src={downloadUrl}> or <a href={downloadUrl}>
}
```

### API client

Add to `packages/client-common/src/infrastructure/api-clients/file-api.client.ts`:

```typescript
import { apiRequest } from '../api-request';
import { z } from 'zod';

const presignedUploadSchema = z.object({
  uploadUrl: z.string(),
  fileKey: z.string(),
  expiresIn: z.number(),
});

const presignedDownloadSchema = z.object({
  downloadUrl: z.string(),
  expiresIn: z.number(),
});

export const fileApiClient = {
  getPresignedUploadUrl: (body: { filename: string; contentType: string }) =>
    apiRequest('/api/files/presigned-upload', {
      method: 'POST',
      body,
      schema: presignedUploadSchema,
    }),

  getPresignedDownloadUrl: (key: string) =>
    apiRequest(`/api/files/presigned-download/${encodeURIComponent(key)}`, {
      schema: presignedDownloadSchema,
    }),
};
```

---

## 10. Env Vars Required

Add to `.env.local`:

```dotenv
FILE_SERVICE_PORT=3004
API_FILE_URL=http://localhost:3004/api
NEXT_PUBLIC_API_FILE_URL=http://localhost:3004/api
EXPO_PUBLIC_API_FILE_URL=http://localhost:3004/api
FILES_S3_BUCKET_NAME=files-local
```

Also add `s3` to LocalStack services in `docker-compose.yml`:

```yaml
SERVICES=dynamodb,sqs,s3
```

Create the S3 bucket in LocalStack via `scripts/setup-localstack.ts`:

```typescript
// In BUCKET_CONFIGS or similar setup array
const BUCKET_NAME = process.env.FILES_S3_BUCKET_NAME ?? 'files-local';
await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
```

---

## 11. CD Service Registry

Add to `.github/service-registry.json` → `infrastructure.s3Buckets`:

```json
{
  "name": "files",
  "envVar": "FILES_S3_BUCKET_NAME"
}
```

Add to the `file-api-service` entry in `apiServices`:

```json
{
  "name": "file-api-service",
  "distPath": "dist/apps/files/file-api-service/main.js",
  "domain": "files",
  "type": "api",
  "handler": "handler",
  "memorySize": 256,
  "timeout": 30,
  "envVars": ["FILES_S3_BUCKET_NAME"]
}
```

---

## 12. Security Considerations

- **Presigned upload URLs must be scoped to a content type** — the client provides `contentType` and the presigned URL is signed for that specific MIME type. Uploading a different content type to the URL fails (S3 enforces this).
- **Presigned URLs expire** — the default is 5 minutes (`expiresIn=300`). Never use expiry longer than 15 minutes for upload URLs.
- **File key validation** — when accepting a `fileKey` from a domain client (e.g., `PATCH /users/:id { avatarKey }`), be aware the key was generated by your own service and is not user-controlled content. Do not use keys as file system paths.
- **Never put user-provided filenames directly into S3 keys without sanitization.** The `S3FileStorage` implementation sanitizes filenames before including them in the key.

---

## 13. Checklist

- [ ] `file-api-service` wired with `S3FileStorage` from `@mma/aws-s3`
- [ ] `FILES_S3_BUCKET_NAME` env var present in `.env.local` and `service-registry.json`
- [ ] `s3` added to `SERVICES=` in `docker-compose.yml`
- [ ] S3 bucket created in `scripts/setup-localstack.ts`
- [ ] Domain entity stores only `fileKey` (string), never the full URL
- [ ] Frontend file upload goes through `file-api-client` — never calls S3 directly
- [ ] Presigned download URL fetched from `file-api-service` before rendering images/links
- [ ] Backend service registered in `service-registry.json` → `infrastructure.s3Buckets`
- [ ] Health endpoint present (`@Get('health')`, `@Public()`, returns `{ status: 'ok', service: 'file-api-service' }`)
