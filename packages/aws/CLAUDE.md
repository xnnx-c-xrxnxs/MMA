# AWS Packages Context

This file loads automatically for any file inside `packages/aws/`. These packages wrap AWS SDK clients with patterns that match this codebase's conventions (Secrets Manager allow-list, SQS publisher ports, Cognito vs LocalAuth provider pattern).

---

## Package Index

| Package | Purpose | Used by |
|---|---|---|
| `@old-st/aws-secrets` | `SecretsConfig.resolve(['KEY'])` — Lambda cold-start hydration of selected keys from a project-wide Secrets Manager secret | Every Prisma-based service's `main.ts` |
| `@old-st/aws-cognito` | `IAuthProvider` abstract class + `CognitoAuthProvider` + `LocalAuthProvider` | `auth-api-service` only |
| `@old-st/aws-sqs` | `SqsClientFactory`, `SqsStandardEventPublisher`, `SqsFifoEventPublisher` (auto-inject correlationId + trace context) | All services that publish events |
| `@old-st/aws-s3` | `S3ClientFactory`, `S3FileStorage` (presigned PUT/GET URL generation) | `file-api-service` only |

---

## Critical Rules

### `aws-secrets` — Allow-list pattern only

`SecretsConfig.resolve(['ORDERS_DATABASE_URL', 'OTHER_KEY'])` populates **only the listed keys** from the secret into `process.env`. Never use a "load all" variant — it would leak unrelated keys into the service's environment and grow the cold-start bundle unnecessarily.

```ts
// ✅ Correct — explicit allow-list
import { SecretsConfig } from '@old-st/aws-secrets';
await SecretsConfig.resolve(['ORDERS_DATABASE_URL']);

// ❌ Forbidden — would expose unrelated keys
const allSecrets = await SecretsConfig.resolveAll();
```

The `AWS_SECRETS_ARN` env var is injected by Terraform. Locally (`STAGE=local`), `SecretsConfig.resolve` is skipped — values come from `.env.local`.

### `aws-cognito` — Provider abstraction

Services depending on auth NEVER import `CognitoIdentityProviderClient` directly. They depend on `IAuthProvider`. The wiring layer (in `auth-api-service`'s module) chooses `CognitoAuthProvider` or `LocalAuthProvider` based on `STAGE`.

This is the same dependency-inversion pattern as the repository interfaces in domain packages.

### `aws-sqs` — Publisher rules

| Publisher | Use case | Queue type |
|---|---|---|
| `SqsFifoEventPublisher` | **Default** — ordered delivery, exactly-once processing | FIFO SQS (`.fifo` suffix required) |
| `SqsStandardEventPublisher` | Explicit opt-out — high-throughput fan-out, no ordering requirement | Standard SQS |

Both publishers **automatically**:
1. Inject `correlationId` from `getCorrelationId()` into the event body
2. Inject OTel trace context (`traceparent`, `tracestate`) into MessageAttributes via `injectTraceContext`

**Do not** manually add either. **Do not** wrap or extend these classes — if a behaviour is missing, add it inside the publisher class itself.

**`SqsFifoEventPublisher` requires `options.groupId`** on every `publish()` call. Use the root entity ID (e.g. `userId`, `orderId`) as the `groupId` so all events for the same entity process in order.

**`delaySeconds` is not supported** on FIFO queues — do not pass it in `EventPublishOptions` when publishing to FIFO.

Event body must include `correlationId: z.string().optional()` in its Zod schema.

### `aws-s3` — File access only via presigned URLs

`S3FileStorage` exposes:
- `generatePresignedUploadUrl(key, contentType, expiresIn)` — returns PUT URL
- `generatePresignedDownloadUrl(key, expiresIn)` — returns GET URL

**Never** add methods that read or write file bytes through the backend. All file IO happens directly between the client and S3 using the presigned URL — see Golden Rule #37 in `CLAUDE.md`.

---

## Local Behaviour

All AWS SDK clients in these packages support a LocalStack endpoint override:

```ts
// SqsClientFactory.create() reads:
process.env.LOCALSTACK_ENDPOINT      // → http://localhost:4566 locally
process.env.AWS_ACCESS_KEY_ID         // → 'test' locally
process.env.AWS_SECRET_ACCESS_KEY     // → 'test' locally
process.env.DEFAULT_REGION            // → eu-west-2 (note: NOT AWS_REGION which Lambda auto-injects)
```

Same pattern for `S3ClientFactory`. `SecretsConfig` short-circuits to a no-op when `STAGE=local` — values come from `.env.local`. `CognitoAuthProvider` is replaced by `LocalAuthProvider` via the wiring layer.

---

## Anti-Patterns

- ❌ Importing AWS SDK clients (`@aws-sdk/client-*`) directly into a service's domain or application layer
- ❌ Calling `SecretsConfig.resolveAll()` or any "load all keys" pattern
- ❌ Using `SqsStandardEventPublisher` as the default — always use `SqsFifoEventPublisher` unless you have a specific reason to opt out (high-throughput fan-out with no ordering requirement)
- ❌ Wrapping either publisher to add correlationId / trace context manually (both already do this automatically)
- ❌ Using `CognitoIdentityProviderClient` outside the `auth-api-service` module
- ❌ Streaming file bytes through the backend (always use presigned URLs)
- ❌ Reading `process.env.AWS_REGION` directly (Lambda auto-injects it; locally use `DEFAULT_REGION`)

---

## When to Add a New `aws-*` Package

Create a new package under `packages/aws/` only when:
1. Multiple services need the same AWS SDK + same conventions, AND
2. The conventions go beyond a thin SDK wrapper (auth abstraction, allow-list secrets, auto-correlation injection, etc.)

For one-off SDK usage in a single service, just import the SDK client directly inside the service's `infrastructure/` layer.
