---
name: mobile-push-notifications
description: Add server-driven push notifications to the Expo mobile app via `expo-notifications` + a backend `notification-domain` package + a Lambda event-handler that consumes domain events and posts to Expo Push. Use this when shipping order-status pings, marketing alerts, or any cross-domain user-targeted push.
---

# Mobile Push Notifications

> **Status:** This is a planning skill. The runtime pieces (notification-domain, notification-api-service, Expo registration hook) are NOT yet implemented in the template. Use this skill as a blueprint when adding push end-to-end.

Push notifications require coordinated changes across **four layers**:

1. **Mobile** — request permission, register an Expo Push Token, send it to the backend.
2. **Backend domain** — `notification-domain` package storing `(userId, deviceToken, platform, lastSeenAt)`.
3. **Backend service** — `notification-api-service` HTTP API for `POST /devices` (register) and `DELETE /devices/:id` (deregister). Plus an SQS event-handler that consumes domain events (e.g. `ORDER_STATUS_CHANGED`) and dispatches via Expo Push.
4. **Infrastructure** — DynamoDB table `Devices`, SQS queue `notification-events`, optionally an SNS topic if you outgrow Expo's free tier.

## Sequence

```
[mobile sign-in]
     │
     ▼
expo-notifications.getExpoPushTokenAsync()
     │
     ▼
POST /api/notifications/devices  { token, platform: 'ios' | 'android' }
     │
     ▼
notification-api-service writes to Devices table

…later…

[order-event-handler-service consumes ORDER_STATUS_CHANGED from SQS]
     │
     ▼
publishes a downstream event onto notification-events queue
     │
     ▼
notification-event-handler-service:
     1. Resolves customer userId → list of deviceTokens
     2. POSTs batch to https://exp.host/--/api/v2/push/send (Expo Push API)
     3. Logs failures, optionally drops invalid tokens

[user receives push on device]
     │
     ▼
expo-notifications response listener navigates to data.url via expo-router
```

## Mobile setup (sketch)

```ts
import * as Notifications from 'expo-notifications';

export async function registerForPush(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await deviceApiClient.register({ token, platform: Platform.OS });
}
```

Hook this into `AuthProvider.onSignIn`. On sign-out, call `deviceApiClient.deregister(token)`.

Foreground / background handling:

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Tap-to-open
Notifications.addNotificationResponseReceivedListener((res) => {
  const url = res.notification.request.content.data?.url;
  if (typeof url === 'string') router.push(url);
});
```

## Backend domain (sketch)

```
packages/notification-domain/
  src/
    domain/
      entities/device.entity.ts           ← (userId, token, platform, lastSeenAt)
      constants/device-platform.constant.ts
    application/
      use-cases/
        register-device/
        deregister-device/
        list-devices-for-user/
      interfaces/
        device-repository.interface.ts
    infrastructure/
      schemas/DeviceSchema.ts             ← DynamoDB OneTable
      repositories/dynamo-device.repository.ts
```

The notification dispatcher itself is **not** a domain — it's pure infrastructure. Place it inside `apps/notifications/notification-event-handler-service/src/infrastructure/expo-push/` as an adapter behind an `IPushDispatcher` interface.

## Infrastructure registry

`.github/service-registry.json`:

```json
{
  "infrastructure": {
    "dynamodbTables": [
      {
        "name": "Devices",
        "domain": "notification",
        "primaryKey": { "pk": "USER#{userId}", "sk": "DEVICE#{token}" }
      }
    ],
    "sqsQueues": [
      { "name": "notification-events", "domain": "notification" }
    ]
  },
  "apiServices": [
    { "name": "notification-api-service", "domain": "notification", "envVars": ["DEVICES_DYNAMODB_TABLE_NAME"] }
  ],
  "eventHandlerServices": [
    { "name": "notification-event-handler-service", "domain": "notification", "sqsQueueRef": "notification-events", "envVars": ["EXPO_ACCESS_TOKEN"] }
  ]
}
```

## Cross-domain event routing

Order domain publishes `ORDER_STATUS_CHANGED` to the **order-events** queue (its own outbox). The notification event handler subscribes to a fan-out queue (`notification-events`) — wire the order publisher to also push a translated event onto `notification-events`, OR use SNS-fanout once two consumers exist. For now, the simplest topology is a dedicated `cross-domain-event-handler` (see existing skill) that listens on the publishing domain's queue and re-publishes onto `notification-events` with the right shape.

## Choosing Expo Push vs APNs/FCM directly

| Use Expo Push when… | Use APNs/FCM directly when… |
|---|---|
| You're already on Expo managed workflow | You've ejected to bare workflow |
| Volume < 1M / month | Volume justifies running your own infra |
| You want a single API for both platforms | You need rich notifications, deep customisation |

Expo Push is the default for this template. Migrate later if needed — keep the `IPushDispatcher` interface so the swap is contained.

## Tests

- Mobile: mock `expo-notifications` (`getExpoPushTokenAsync`, `requestPermissionsAsync`); assert the device registration hook fires after sign-in.
- Backend domain: standard `write-domain-tests` pattern — entity invariants + use-case orchestration.
- Event handler: mock `IPushDispatcher`; assert that an `ORDER_STATUS_CHANGED` event for `userId=u1` resolves to a push containing `data.url=/orders/{orderId}`.

## Costs / observability

Wire CloudWatch alarms (`add-monitoring` skill) on:

- `notification-event-handler-service` errors > 0 over 5 min.
- DLQ depth > 0.
- Invalid push tokens (Expo returns `DeviceNotRegistered` — drop these from the table).
