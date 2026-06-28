---
name: mobile-deep-linking
description: Configure custom-scheme + Universal Links / App Links for the Expo mobile app, including iOS associated domains and Android intent filters, and document the URL→route map. Use this when shipping push notifications, sharing links in emails/SMS, or onboarding from a marketing landing page.
---

# Mobile Deep Linking

The Expo mobile app supports two link types simultaneously:

| Link type | Format | Use case |
|---|---|---|
| Custom scheme | `oldst://users/{userId}` | Push notifications, app-internal handoff |
| Universal Link / App Link | `https://{domain}/users/{userId}` | Email, web, SMS — falls back to web if app missing |

Expo Router maps URL paths onto file-based routes automatically; see `apps/mobile/DEEP_LINKING.md` for the full URL→route map.

## Where it's wired

`apps/mobile/app.config.ts`:

```ts
ios.associatedDomains = [`applinks:${universalLinkDomain}`];
android.intentFilters = [{
  action: 'VIEW',
  autoVerify: true,
  data: [{ scheme: 'https', host: universalLinkDomain }],
  category: ['BROWSABLE', 'DEFAULT'],
}];
```

The domain comes from per-env env vars:

```
UNIVERSAL_LINK_DOMAIN_DEV=dev.example.com
UNIVERSAL_LINK_DOMAIN_PREVIEW=preview.example.com
UNIVERSAL_LINK_DOMAIN_PROD=app.example.com
```

When the env var is unset for a given `APP_ENV`, no associated-domain entry is emitted (the app still handles the `oldst://` scheme).

## Hosting the verification files

Both Apple and Google require static files served from your domain (typically via the webapp's `public/.well-known/`):

| Platform | Path | Content-Type |
|---|---|---|
| iOS | `https://{domain}/.well-known/apple-app-site-association` | `application/json` (no extension) |
| Android | `https://{domain}/.well-known/assetlinks.json` | `application/json` |

See `apps/mobile/DEEP_LINKING.md` for the file templates. Get the Android signing-cert SHA-256 from `eas credentials` → Android → production keystore.

## Programmatic navigation

```ts
import { router } from 'expo-router';
router.push(`/users/${userId}`);
```

If the user is not signed in, the `(protected)` route group redirects to `/auth/login`. After sign-in, the original deep-link target is restored from the redirect query.

## Testing

```bash
# iOS Simulator
xcrun simctl openurl booted "oldst://users/abc123"

# Android emulator
adb shell am start -W -a android.intent.action.VIEW -d "oldst://orders/xyz"
```

Universal Links / App Links **only work on real devices** with the production binary installed — Simulator/emulator skip the platform association check, so you'll see the web fallback instead. To validate in the Apple ecosystem use the [App Search API Validator](https://search.developer.apple.com/appsearch-validation-tool).

## When you change the universal-link domain

1. Update the env var in EAS secrets (or `eas.json` `env` block).
2. Bump `version` in `app.config.ts` so OTA updates can't apply across runtime versions.
3. Re-host the AASA / assetlinks file at the new domain.
4. Re-submit to TestFlight / Play Internal so the platform fetches the new association.

## Linking from push notifications

Inside an `expo-notifications` response listener, parse the data payload and navigate:

```ts
addNotificationResponseReceivedListener((response) => {
  const url = response.notification.request.content.data?.url;
  if (typeof url === 'string') router.push(url);
});
```

Convention: backend sends `data.url` as a path (e.g. `/orders/xyz`) so the same payload works for both `oldst://` and Universal-Link surfaces.
