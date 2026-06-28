# File Service Context

This file is automatically loaded when working on any file inside `apps/files/`. It provides the exact current state of the file service so Claude Code starts with full context.

---

## What This Service Does

`file-api-service` is a **thin passthrough service** — it has no domain package and no domain layer. It issues presigned URLs for S3 direct uploads and downloads. File bytes never pass through the backend.

**Flow:**
1. Client calls `POST /api/files/presigned-upload` → receives `{ uploadUrl, fileKey, expiresIn }`
2. Client uploads directly to S3 using the presigned PUT URL
3. Client stores only the `fileKey` in its domain entity
4. Client calls `GET /api/files/presigned-download/:key` → receives `{ downloadUrl, expiresIn }`
5. Client downloads directly from S3 using the presigned GET URL

---

## Ports & Environment Variables

| Variable | Local value | Purpose |
|---|---|---|
| `FILE_SERVICE_PORT` | `3004` | HTTP listen port |
| `FILES_S3_BUCKET_NAME` | (set in `.env.local`) | S3 bucket for file storage |
| `STAGE` | `local` | LocalStack vs real AWS |
| `LOCALSTACK_ENDPOINT` | `http://localhost:4566` | LocalStack Gateway (when `STAGE=local`) |
| `AWS_ACCESS_KEY_ID` | `test` | LocalStack fake credential |
| `AWS_SECRET_ACCESS_KEY` | `test` | LocalStack fake credential |

**Note:** When adding a new `NEXT_PUBLIC_API_FILE_URL` for the webapp, add it to both `.env.local` and `service-registry.json` → `webapp.envVars`.

---

## API Endpoints

**Base path:** `/api` | **Port:** `3004`

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/files/presigned-upload` | Yes | Returns presigned S3 PUT URL + generated `fileKey` |
| `GET` | `/files/presigned-download/:key` | Yes | Returns presigned S3 GET URL for an existing `fileKey` |
| `GET` | `/health` | No (`@Public()`) | Health check → `{ status: 'ok', service: 'file-api-service' }` |

---

## S3FileStorage (from `@mma/aws-s3`)

**Package:** `packages/aws/aws-s3/src/s3-file-storage.ts`

Methods:
- `generatePresignedUploadUrl(key, contentType, expiresIn)` → `{ uploadUrl, fileKey, expiresIn }`
- `generatePresignedDownloadUrl(key, expiresIn)` → `{ downloadUrl, expiresIn }`

**Key generation:** The service generates unique keys using a UUID prefix to prevent collisions: `{uuid}/{originalFilename}`.

**Client factory:** `packages/aws/aws-s3/src/s3-client-factory.ts` — uses LocalStack endpoint when `STAGE=local`.

---

## Architecture Notes

- **No domain package** — thin service with application service → S3FileStorage only.
- **No repository** — nothing is persisted by this service. `fileKey` is stored by the calling domain's entity.
- **Domain services are consumers** — e.g. a user avatar upload: User API stores `avatarFileKey` in `UserEntity`; file retrieval goes through File API presigned URL.
- **CORS** — must allow credentials (`credentials: true`) since frontend uses `credentials: 'include'`.

---

## Files in This Service

```
apps/files/file-api-service/src/
  application/services/file-application.service.ts   ← calls S3FileStorage
  infrastructure/
    config/s3.config.ts                              ← S3Config (reads FILES_S3_BUCKET_NAME)
    s3/s3-file-storage.ts                            ← S3FileStorage instance
  modules/file.module.ts                             ← wires S3FileStorage
  presentation/
    controllers/file.controller.ts
    filters/domain-exception.filter.ts
    guards/jwt-auth.guard.ts
    decorators/public.decorator.ts
    pipes/zod-validation.pipe.ts
```

---

## LocalStack Setup

S3 must be in the `SERVICES=` list in `docker-compose.yml`:

```yaml
SERVICES=dynamodb,sqs,s3
```

The bucket is created by `scripts/setup-localstack.ts`. When `STAGE=local`, the `S3ClientFactory` points to `http://localhost:4566`.

---

## Skills to Use

| Task | Skill |
|---|---|
| Implement or extend file upload/download | `file-upload-s3` |
| Add a new file endpoint | `add-api-endpoints` |
| Add Swagger docs | `swagger-controller-docs` |
| Wire a new domain to store fileKeys | `add-feature-existing-domain` |
| Register S3 bucket in Terraform | `cd-register-service` |
