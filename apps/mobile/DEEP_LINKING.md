# Mobile Deep Linking

The mobile app supports two link types:

| Link type | Format | Use case |
|---|---|---|
| Custom scheme | `oldst://users/{userId}` | Push notifications, app-internal handoff |
| Universal Link / App Link | `https://{universalLinkDomain}/users/{userId}` | Email, web, SMS — falls back to web if app not installed |

Expo Router maps URLs onto file-based routes automatically:

| URL | Route file |
|---|---|
| `oldst://(tabs)` or `https://{host}/` | `apps/mobile/src/app/(tabs)/index.tsx` |
| `oldst://users` | `apps/mobile/src/app/(tabs)/users.tsx` |
| `oldst://users/{userId}` | `apps/mobile/src/app/users/[userId].tsx` |
| `oldst://products/{productId}` | `apps/mobile/src/app/products/[productId].tsx` |
| `oldst://orders/{orderId}` | `apps/mobile/src/app/orders/[orderId].tsx` |
| `oldst://auth/login` | `apps/mobile/src/app/auth/login.tsx` |

## Setup

### 1. Configure the universal link domain

Set per-env env vars (e.g. in EAS secrets, or `.env` for local builds):

```
UNIVERSAL_LINK_DOMAIN_DEV=dev.example.com
UNIVERSAL_LINK_DOMAIN_PREVIEW=preview.example.com
UNIVERSAL_LINK_DOMAIN_PROD=app.example.com
```

`apps/mobile/app.config.ts` reads these and emits:

- `ios.associatedDomains: ['applinks:{domain}']`
- `android.intentFilters: [{ action: 'VIEW', autoVerify: true, data: [{ scheme: 'https', host: '{domain}' }], category: ['BROWSABLE', 'DEFAULT'] }]`

### 2. Host the verification files

Serve these from the universal-link domain (e.g. via the webapp's `public/.well-known/`):

#### iOS — `https://{domain}/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "{TEAM_ID}.com.oldst.mobile",
        "paths": ["*"]
      }
    ]
  }
}
```

`Content-Type` must be `application/json`. No file extension. iOS revalidates ~ every few days.

#### Android — `https://{domain}/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com_oldst_mobile",
      "sha256_cert_fingerprints": ["{SHA256_OF_SIGNING_CERT}"]
    }
  }
]
```

Get the cert fingerprint via `eas credentials` → Android → production keystore.

### 3. Test locally

```bash
# iOS Simulator
xcrun simctl openurl booted "oldst://users/abc123"

# Android emulator
adb shell am start -W -a android.intent.action.VIEW -d "oldst://orders/xyz"
```

For Universal Links, install the production binary on a real device — Simulator/emulator will not invoke the app for `https://` links until the platform has verified the association files.

## Routing from a deep link

Expo Router's `useLocalSearchParams` and dynamic routes ([userId]) handle parameter extraction automatically. To programmatically navigate from a notification handler:

```ts
import { router } from 'expo-router';
router.push(`/users/${userId}`);
```

If the user is not signed in when a deep link lands, the `(protected)` route group's redirect logic should land them on `/auth/login` and resume after sign-in.
