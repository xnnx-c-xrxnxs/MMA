---
description: "Plan and scaffold push notifications end-to-end (mobile + backend + infrastructure). USE WHEN the user asks 'add push notifications', 'send push to mobile', 'order status push', 'notification service'. This is a multi-day workflow — the prompt forces a planning phase before any code."
---

# Add Push Notifications — Guided Workflow

Push notifications cross every layer of the stack: mobile (`expo-notifications`), backend domain (`notification-domain`), backend service (`notification-api-service` + event handler), infrastructure (DynamoDB table, SQS queue), and CD (registry, monitoring). **Do NOT generate code until Phase 0 is complete.**

Read the [`mobile-push-notifications`](../skills/mobile-push-notifications/SKILL.md) skill in full before answering.

---

## Phase 0 — Interview

Ask in a single structured message and wait for answers.

### Required Information

1. **Trigger event:** which existing domain event(s) should produce a push? (e.g. `ORDER_STATUS_CHANGED`, `PRODUCT_BACK_IN_STOCK`)
2. **Recipients:** how do we resolve event → user(s)? (event payload already contains `userId`, or do we need a lookup?)
3. **Payload:** what does the user see (title, body, deep-link path)?
4. **Quiet hours / preferences:** are user-controllable preferences in scope, or is this opt-in only via OS permission?
5. **Scale:** expected push volume per day. If > 10k/day, evaluate APNs/FCM directly vs Expo Push (see skill).
6. **Topology:** subscribe directly to the publishing domain's queue, or fan out via a dedicated `notification-events` queue? (recommended: dedicated queue once 2+ producers exist)
7. **Token storage:** confirm DynamoDB single-table fit (PK=`USER#{userId}`, SK=`DEVICE#{token}`).
8. **Failure handling:** on `DeviceNotRegistered` from Expo, delete the device row?

---

## Phase 1 — Plan

Produce an execution checklist tied to existing skills. Example for `ORDER_STATUS_CHANGED → push`:

### Backend domain (`new-domain-package` skill)

- [ ] Create `packages/notification-domain/` with `Device` entity.
- [ ] Constants: `DEVICE_PLATFORMS = ['ios','android']`.
- [ ] Domain exception: `InvalidExpoTokenError`.
- [ ] Repository interface + DynamoDB implementation (`dynamo-repository` + `new-dynamo-schema` skills).
- [ ] Use cases: `RegisterDeviceUseCase`, `DeregisterDeviceUseCase`, `ListDevicesForUserUseCase`.
- [ ] Contracts: `packages/contracts/notification/` with Zod schemas (`add-contracts` skill).

### Backend services (`nestjs-service-layers` + `sqs-event-driven-service` skills)

- [ ] `apps/notifications/notification-api-service` — `POST /devices`, `DELETE /devices/:token`. Uses `@CurrentUser()` for authoring.
- [ ] `apps/notifications/notification-event-handler-service` — consumes `notification-events` queue.
- [ ] Cross-domain dispatcher (`cross-domain-event-handler` skill): consume `order-events`, translate → publish onto `notification-events`. (Or skip the relay if only one publisher.)
- [ ] `IPushDispatcher` port + `ExpoPushDispatcher` adapter in `infrastructure/expo-push/`.
- [ ] Mock dispatcher for `STAGE=local`.

### Infrastructure (`cd-register-service` skill)

- [ ] Add `Devices` table to `service-registry.json` → `infrastructure.dynamodbTables`.
- [ ] Add `notification-events` queue to `infrastructure.sqsQueues`.
- [ ] Register both services in `apiServices` / `eventHandlerServices`.
- [ ] Set `EXPO_ACCESS_TOKEN` in env block (Secrets Manager-backed).
- [ ] CloudWatch alarms via `add-monitoring` skill: handler errors > 0, DLQ depth > 0.

### Mobile (`mobile-new-domain-feature` + this skill)

- [ ] Add `expo-notifications` to `apps/mobile/package.json`.
- [ ] Add to `app.config.ts` plugins.
- [ ] `apps/mobile/src/lib/push-registration.ts`: `registerForPush(userId)` + `deregister(token)`.
- [ ] Hook into `AuthProvider.onSignIn` and `signOut`.
- [ ] Set up `Notifications.setNotificationHandler` and `addNotificationResponseReceivedListener` in `_layout.tsx`.
- [ ] Tap-to-open deep link via `expo-router` (use `mobile-deep-linking` skill).

### CD / verification

- [ ] `service-registry.env`: `EXPO_ACCESS_TOKEN`, `DEVICES_DYNAMODB_TABLE_NAME`, queue URL.
- [ ] `lint-standards.ts` passes (registry sync check).
- [ ] Local: trigger an order status change → see push token in logs (mock dispatcher) on `STAGE=local`.
- [ ] Preview env: real Expo Push delivery to a TestFlight build.

---

## Phase 2 — Execute (only after the user approves Phase 1)

Before execution, fan out **read-only** subagents in parallel:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: notification-domain, mobile-push-notifications, sqs-event-driven-service, sqs-event-publisher, cross-domain-event-handler, cd-register-service, mobile-deep-linking")`
- `Agent(subagent_type="domain-explorer", prompt="domain=user, focus=auth+events, thoroughness=quick")` — push relies on userId from auth and on consuming user/order events.
- `Agent(subagent_type="port-claim-checker", prompt="mode=next-port, newServiceName=notification-api-service")` — only if the API service is in scope.
- `Agent(subagent_type="event-flow-tracer", prompt="event=ORDER_STATUS_CHANGED")` — confirms the source event already exists or surfaces what to add.

Then run skill prompts in order. Validate after each phase via `nx test` and `Bash`. Push notifications are too cross-cutting to do in a single shot — checkpoint at each layer.

### Final verification

After all layers are wired:

1. `pnpm tsx scripts/lint-standards.ts` — no new violations (registry sync check).
2. `pnpm nx run-many -t test -p notification-domain notification-event-handler-service notification-api-service mobile`.
3. Pre-merge subagent fan-out (read-only, in parallel):
   - `Agent(subagent_type="dependency-auditor", prompt="scope=apps/notifications/**,packages/notification-domain/**,apps/mobile/**")`
   - `Agent(subagent_type="golden-rule-validator", prompt="scope=service:notification-event-handler-service, ruleSet=event-handler")`
   - `Agent(subagent_type="event-flow-tracer", prompt="event=ORDER_STATUS_CHANGED")` — confirms the new dispatcher appears as a consumer end-to-end.

---

## Out of scope for this prompt

- iOS / Android **provisional** notifications (silent prompts).
- Notification grouping / threads.
- Marketing-grade segmentation. (Use a dedicated tool like Customer.io if needed.)
- Web Push (use `web-push` + Service Workers — separate workflow).
