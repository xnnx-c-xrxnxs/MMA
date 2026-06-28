---
name: mobile-eas-build-update
description: Configure EAS Build and EAS Update for the mobile app — channels, runtime version, profiles, env-driven app.config.ts. Use this when adding a new build profile, channel, or env var to the mobile app, or when scaffolding mobile builds for the first time.
---

# Mobile — EAS Build & Update

The mobile app uses **EAS Build** for native binaries and **EAS Update** for OTA JavaScript updates. Configuration lives in two files:

- `apps/mobile/eas.json` — build/update/submit profiles.
- `apps/mobile/app.config.ts` — dynamic Expo config driven by `APP_ENV`.

## When to Read This Skill

- Adding a new EAS profile (e.g. `qa`).
- Adding a new env var that needs to reach mobile.
- Wiring a new bundle identifier suffix.
- Updating `runtimeVersion` strategy.

## Required Information

1. **What is the goal?** New profile, new env, new bundle ID, runtime version change.
2. **Which channel(s)?** Must align with the EAS Update branch the OTA workflow targets.
3. **Native dependency change?** If yes, runtime version must bump and a new build is required (OTA alone won't ship the change).

## Channel Model

| Profile | Channel | Bundle suffix | Use |
|---|---|---|---|
| `development` | `development` | `.dev` | Internal dev client (real-device testing) |
| `preview` | `preview` | `.preview` | QA, stakeholder review |
| `production` | `production` | _(none)_ | App Store / Play Store |

The same channel name is used by:
- `eas.json` → `build.{profile}.channel`
- `eas.json` → `build.{profile}.env.APP_ENV`
- The OTA workflow (`cd-mobile-deploy.yml`) `--branch {profile}` argument.

## Runtime Version

`app.config.ts` sets:
```ts
runtimeVersion: { policy: 'appVersion' }
```

This means OTA updates only deliver to native binaries with the same `version`. When you change a native dependency, bump `version` (e.g. `1.0.0` → `1.1.0`) and produce a new `eas build`. JS-only changes ship via `eas update` against the existing version.

## Adding a New Env Var

1. Add the value to `apps/mobile/.env.local` (gitignored) and `apps/mobile/.env.local.example`.
2. Add a `EXPO_PUBLIC_*` lookup to `app.config.ts` `extra:` block.
3. Read it in code via `Constants.expoConfig?.extra?.{key}`.
4. Add the value under each profile's `env:` block in `eas.json` (or use `eas secret:create` for sensitive values).

## Adding a New Profile

1. Add a new entry under `eas.json` `build.{name}` with `channel`, `env`, and platform-specific options.
2. Add the profile to `cd-mobile-deploy.yml` `inputs.profile.options[]`.
3. Decide bundle suffix — extend `BUNDLE_SUFFIX` map in `app.config.ts`.

## Rules

1. **Never commit secrets** to `eas.json` or `app.config.ts`. Use `eas secret:create` for tokens (Sentry auth token, store credentials).
2. **`runtimeVersion` must always be a `policy`**, not a literal — otherwise every JS change requires a new native build.
3. **Bundle identifier suffixes are required for non-prod** profiles so dev/preview clients can co-exist on the same device with production.
4. **Every new env var must appear in three places**: `app.config.ts` `extra`, the relevant `eas.json` profile `env`, and `.env.local.example`.

## Common Pitfalls

| Symptom | Cause |
|---|---|
| OTA update doesn't appear on device | `runtimeVersion` mismatch — native binary built before the JS change. Bump version + rebuild. |
| Dev and prod can't co-exist on a device | Missing bundle ID suffix in `app.config.ts`. |
| Env var is `undefined` in mobile code | Read directly via `process.env` won't work in production — must go through `Constants.expoConfig.extra`. |
