---
name: mobile-cd-pipeline
description: Trigger and configure the mobile CD pipeline (`cd-mobile-deploy.yml`) — OTA updates, native builds, store submissions. Use this when shipping a mobile change, releasing to TestFlight / Play Console, or modifying the mobile deploy workflow.
---

# Mobile — CD Pipeline

The mobile CD pipeline is `.github/workflows/cd-mobile-deploy.yml`. It is **manual-trigger only** (`workflow_dispatch`) with three actions:

| Action | What it does | When to use |
|---|---|---|
| `update` | `eas update --branch {channel}` — OTA push of JS bundle | Bug fixes, copy changes, JS-only features |
| `build` | `eas build --profile {profile}` — native binary | Native dep change, version bump, first build of a profile |
| `build-and-submit` | `build` then `eas submit` | Production releases to App Store / Play Store |

## When to Read This Skill

- Shipping any mobile change (always — pick the right action).
- Adjusting the workflow inputs.
- Adding a new GitHub secret consumed by EAS.

## Decision Flow

```
Did the change touch native deps (package.json deps that include native code) or app.config.ts?
├── No  → action=update (OTA, fast, no review)
└── Yes → action=build (or build-and-submit for prod)
```

If unsure, run `pnpm nx run mobile:doctor` (`expo-doctor`) — it flags native changes.

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `EXPO_TOKEN` | Authenticates EAS CLI. Generate via `eas account:view --json` after `eas login`. |
| `SENTRY_AUTH_TOKEN` | EAS post-build hook uploads sourcemaps to Sentry. Optional — Sentry init still works without it but stack traces are minified. |
| `APPLE_APP_SPECIFIC_PASSWORD` | iOS App Store submit. Only required for `build-and-submit` on iOS prod. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Play Console submit. Only required for `build-and-submit` on Android prod. |

Never store these in `eas.json` directly — use `eas secret:create` so EAS injects them at build time.

## Triggering a Release

### OTA (most common)

1. Open Actions → "CD: Mobile Deploy" → Run workflow.
2. action=`update`, profile=`production` (or `preview`), platform=`all`, message=`<release notes>`.
3. Wait ~2 minutes. Update is live on next app open.

### Native build (production)

1. Bump `version` in `app.config.ts`.
2. Run workflow: action=`build-and-submit`, profile=`production`, platform=`all`.
3. EAS Build takes 15–25 minutes per platform.
4. iOS: review TestFlight build, promote in App Store Connect.
5. Android: review internal track, promote to production.

## Rules

1. **Never run `eas build` from a developer laptop** for a production release — only via the workflow. Local builds bypass the audit trail and may use untrusted env vars.
2. **OTA updates must target the same `runtimeVersion`** as the installed binary. Trying to push an OTA after bumping `version` does nothing — users see the old binary's update channel.
3. **Production submits require a tagged commit** — by convention, tag `mobile-v{version}` after a successful prod build.
4. **Every release needs a Sentry release marker** — the post-build hook does this automatically when `SENTRY_AUTH_TOKEN` is configured.

## Common Pitfalls

| Symptom | Cause |
|---|---|
| `eas update` succeeds but devices don't pick it up | Native binary was rebuilt without bumping `runtimeVersion` policy / version. |
| Workflow fails with "Token expired" | `EXPO_TOKEN` is rotated yearly — regenerate. |
| Build artifacts missing sourcemaps in Sentry | `SENTRY_AUTH_TOKEN` not set as EAS secret. |
