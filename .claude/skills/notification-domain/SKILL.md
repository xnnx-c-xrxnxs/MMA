---
name: notification-domain
description: Scaffold the backend `notification-domain` package and `notification-event-handler-service` that consume cross-domain events (e.g. `ORDER_STATUS_CHANGED`) and dispatch user-targeted push notifications via Expo Push (mobile) and / or email (SES). Use this when adding push notifications end-to-end — paired with the `mobile-push-notifications` skill on the device side.
---

# Notification Domain & Dispatcher

Related skills:
- `new-domain-package` skill — base scaffolding for the `notification-domain` package
- `sqs-event-driven-service` skill — base scaffolding for the dispatcher consumer
- `cross-domain-event-handler` skill — pattern for consuming events from other bounded contexts
- `mobile-push-notifications` skill — mobile-side device token registration + permission flow
- `add-push-notifications.md` — the orchestrator that drives this skill

---

## When to Use This Skill

You are adding **server-driven push notifications** and need the backend half of the pipeline:
- A `notification-domain` package that owns user device tokens + notification preferences.
- A `notification-event-handler-service` (SQS consumer) that subscribes to events from other domains and dispatches push payloads.

If you are only doing the mobile half (registration, foreground handling, deep-link routing), use the `mobile-push-notifications` skill instead.

If you are wiring a brand-new SQS consumer that is NOT the notification dispatcher, use `sqs-event-driven-service` instead.

---

## Architecture Overview

```
order-api-service          notification-event-handler-service          Expo Push API
       │                              │                                       │
       │ ORDER_STATUS_CHANGED         │ 1. Receive event                      │
       ├────► order-events SQS ──────►│ 2. Look up user's deviceTokens        │
                                      │ 3. Build push payload                 │
                                      │ 4. POST batch ───────────────────────►│
                                      │ 5. Mark delivery (success/fail)       │
                                      │ 6. Prune invalid tokens               │
```

- **Subscribes to events from multiple domains** (order, user, product, etc.) via the **notification-events** consumer-owned SQS inbox (Pattern 2 — Cross-Domain Async Events).
- **Owns its own data:** `Device` (per-user push tokens), `NotificationPreference` (per-user opt-ins), `DeliveryLog` (audit trail).
- **Never reads from another domain's repository.** All input arrives via events.

---

## What This Skill Produces

### Backend domain package — `packages/notification-domain/`

Standard structure (see `new-domain-package` skill for the layer template):

```
domain/
  entities/
    device.entity.ts                 ← userId, expoPushToken, platform, lastSeenAt
    notification-preference.entity.ts
    delivery-log.entity.ts
  constants/
    device-platforms.ts              ← IOS, ANDROID, WEB
    notification-channels.ts         ← PUSH, EMAIL
    delivery-statuses.ts             ← QUEUED, SENT, FAILED, INVALID_TOKEN
  exceptions/
    device-not-found.error.ts
    invalid-token.error.ts
application/
  use-cases/
    register-device/
    unregister-device/
    update-preferences/
    record-delivery/
    prune-invalid-tokens/
  interfaces/
    device-repository.interface.ts
    preference-repository.interface.ts
    delivery-log-repository.interface.ts
    push-dispatcher.interface.ts     ← port for Expo Push (mocked in tests)
infrastructure/
  schemas/                           ← DynamoDB OneTable
    DeviceSchema.ts
    PreferenceSchema.ts
    DeliveryLogSchema.ts
  repositories/
    dynamo-device.repository.ts
    dynamo-preference.repository.ts
    dynamo-delivery-log.repository.ts
  push/
    expo-push-dispatcher.ts          ← adapter implementing IPushDispatcher
```

### Backend service — `apps/notifications/notification-event-handler-service/`

SQS consumer (see `sqs-event-driven-service` skill for the template):

```
src/
  application/
    interfaces/
      normalized-sqs-record.interface.ts
    services/
      notification-event-handler.service.ts   ← typed switch by event type
    handlers/
      handle-order-status-changed.ts
      handle-user-created.ts
      ...
  infrastructure/
    sqs/sqs-local.service.ts
  modules/
    notification.module.ts
  main.ts
```

### Backend API service (optional, only if mobile needs to register devices) — `apps/notifications/notification-api-service/`

Use `nestjs-service-layers` skill. Endpoints:
- `POST /api/notifications/devices` — register a device (uses `@CurrentUser()` for `userId`)
- `DELETE /api/notifications/devices/:deviceId` — unregister
- `GET /api/notifications/preferences` — read preferences
- `PATCH /api/notifications/preferences` — update preferences

---

## Step-By-Step Implementation

1. **Read prerequisite skills** in order:
   - `new-domain-package` — domain package layout
   - `new-domain-entity` + `domain-business-rules` — entities + rules
   - `new-dynamo-schema` + `dynamo-repository` — persistence
   - `sqs-event-driven-service` — handler scaffold
   - `cross-domain-event-handler` — consuming events from other bounded contexts
   - `nestjs-service-layers` — only if adding the API service

2. **Define the IPushDispatcher port** in `application/interfaces/push-dispatcher.interface.ts`:
   ```ts
   export abstract class IPushDispatcher {
     abstract sendBatch(messages: PushMessage[]): Promise<PushDeliveryResult[]>;
   }
   ```
   Use cases depend on the abstract class. The `ExpoPushDispatcher` implementation lives in `infrastructure/push/`.

3. **Define event subscriptions.** The handler service listens on a single `notification-events` SQS queue. Each publishing domain (order, user, product) gets its own handler file under `application/handlers/`. The dispatcher in `notification-event-handler.service.ts` switches by `event.type` (validated via `safeParse` on the publishing domain's discriminated-union schema imported from `@mma/contracts/{publishing-domain}`).

4. **Idempotency.** Every handler MUST be idempotent — SQS guarantees at-least-once delivery. Use `(eventId, channel)` as the dedupe key, store recent IDs in the `DeliveryLog`, and skip if already dispatched.

5. **Token pruning.** When Expo Push returns `DeviceNotRegistered`, mark the token `INVALID_TOKEN` in the device repository and stop sending. Run `prune-invalid-tokens` periodically (scheduled Lambda or on-demand).

6. **Preferences gating.** Before dispatch, check the user's `NotificationPreference` for the relevant channel + event type. If opted out, log and skip.

7. **Register infrastructure** — see `cd-register-service` skill:
   - DynamoDB tables for Device, Preference, DeliveryLog (with GSIs for `userId` lookup).
   - SQS queue `notification-events` (consumer-owned inbox, Golden Rule for cross-domain queue naming).
   - Lambda for the event handler.
   - Optional Lambda + API Gateway route for the API service.
   - Secrets Manager entry for the Expo Push access token.

8. **Wire publishers.** For each publishing domain, add an `SqsFifoEventPublisher` provider that sends to `notification-events` (in addition to whatever queues that domain already publishes to). See `sqs-event-publisher` skill.

9. **Tests.** Use `write-domain-tests` for domain + use case + handler tests. Mock `IPushDispatcher`. Add at least one E2E test in `apps/notifications/notification-api-service-e2e/` if the API service is included.

---

## Architectural Rules

1. **The dispatcher service NEVER reads from another domain's repository.** All input arrives via SQS events from `@mma/contracts/{publishing-domain}/event-schemas` (Golden Rule #15).
2. **Device tokens are PII** — always encrypted at rest (DynamoDB encryption-at-rest is on by default), never logged in plaintext, and never returned in API responses to clients other than the owning user.
3. **Expo Push access token lives in AWS Secrets Manager.** Resolved at Lambda cold-start via `SecretsConfig.resolve(['EXPO_PUSH_TOKEN'])` (see `aws-secrets` package) — never an env var.
4. **Batching.** Expo Push accepts up to 100 messages per request. Always batch — never one HTTP call per recipient.
5. **Failures are observable.** Every dispatch failure writes a `DeliveryLog` row with the upstream error code. CloudWatch alarms on `DeliveryLog` failure rate (see `add-monitoring` skill).
6. **The handler service has no controllers.** No HTTP, no Swagger, no health endpoint via `@Get('health')` (the handler service has no HTTP server). The optional API service is a separate app.

---

## Skills That Compose With This One

| Task | Also read |
|---|---|
| Mobile registration + permission + foreground handling | `mobile-push-notifications` |
| Wiring publishers in existing domains | `sqs-event-publisher` |
| Adding domain events | `sqs-event-driven-service` (event schemas section) |
| Wiring deep links from push payloads | `mobile-deep-linking` |
| Registering Lambda + SQS + DynamoDB infrastructure | `cd-register-service` |
| Resolving the Expo Push secret in Lambda | `aws-secrets` package conventions (see `packages/aws/CLAUDE.md`) |
| End-to-end orchestration | `add-push-notifications.md` workflow |
