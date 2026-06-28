# file-api-service

File upload/download API. Issues **S3 presigned URLs** so the client uploads directly to S3 — file bytes never pass through the backend (Golden Rule #37).

## Endpoints

| Method | Path | Public? | Purpose |
|---|---|---|---|
| `POST` | `/api/files/presigned-upload` | 🔒 | Returns `{ uploadUrl, fileKey, expiresIn }` for a PUT to S3 |
| `GET`  | `/api/files/presigned-download/:key` | 🔒 | Returns `{ downloadUrl, expiresIn }` for a GET from S3 |
| `GET`  | `/api/health` | ✅ | Liveness probe |

The webapp + mobile use the `useFileUpload` hook from `@mma/client-common` to consume these endpoints. See the **[webapp-file-upload-ux](../../.claude/skills/webapp-file-upload-ux/SKILL.md)** skill.

## Local dev

Default port: **3004** (`FILE_SERVICE_PORT`). Base URL: `http://localhost:3004/api`.

```sh
pnpm nx serve file-api-service
# or VS Code task: "Service: Serve file-api-service"
```

Local S3 is provided by **LocalStack** (`docker compose up -d`). The bucket is created by `pnpm run localstack:setup`.

## Architecture

The service is intentionally a thin wrapper around `S3FileStorage` from `@mma/aws-s3`. Domain logic (validating file types, recording uploads, etc.) belongs in **the consuming domain**, not here. Store only the `fileKey` returned by `presigned-upload` in your domain entity.

## Environment variables

| Variable | Purpose |
|---|---|
| `FILE_SERVICE_PORT` | HTTP port (default 3004) |
| `STAGE` | `local` routes S3 SDK to LocalStack |
| `FILES_S3_BUCKET` | Bucket name (per-environment) |
| `FILES_S3_REGION` | AWS region |
| `LOCALSTACK_ENDPOINT` | Local only — `http://localhost:4566` |

## Tests

```sh
pnpm nx test file-api-service
```

## See also

- [packages/aws/aws-s3](../../packages/aws/aws-s3/) — `S3FileStorage` implementation
- [.claude/skills/file-upload-s3](../../.claude/skills/file-upload-s3/) — full backend skill
- [.claude/skills/webapp-file-upload-ux](../../.claude/skills/webapp-file-upload-ux/) — frontend skill
