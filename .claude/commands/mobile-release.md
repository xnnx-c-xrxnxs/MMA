---
description: "Trigger a mobile release — OTA update, native build, or store submission. USE WHEN user says 'ship the mobile app', 'release mobile', 'mobile build', 'send mobile OTA', 'submit to app store', 'submit to play store', 'eas update', 'eas build'."
---

# Mobile Release — Guided Workflow

You are orchestrating a mobile release. The pipeline is `cd-mobile-deploy.yml`. This workflow only ever runs against an existing pipeline — you do **not** locally invoke `eas build` or `eas update`.

**Do NOT trigger anything until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **What kind of release is this?**
   - `update` — OTA JS-only push (fast, no review)
   - `build` — produce a native binary (15–25 min per platform)
   - `build-and-submit` — build + submit to App Store / Play Store
2. **Which channel/profile?** `development`, `preview`, or `production`
3. **Which platform?** `ios`, `android`, or `all`
4. **Did this change touch any of:**
   - `package.json` deps containing native code (Expo modules, react-native-* libs)?
   - `app.config.ts` (icons, plugins, permissions)?
   - The `version` field?
   If yes → an OTA `update` will NOT deliver the change. Use `build`.
5. **OTA update message?** (Only for `update`. Used as the changelog in EAS dashboard.)

### Auto-Detection

- Run `git diff origin/main -- apps/mobile/package.json apps/mobile/app.config.ts` and inspect.
- If it touched native deps → recommend `build`. If JS-only → recommend `update`.

**Do not proceed until questions 1–5 are answered.**

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: mobile-eas-build-update, mobile-cd-pipeline, mobile-secure-storage-auth, mobile-error-boundary-sentry, mobile-app-icon-splash")`

Wait for it to return. Confirm the release plan with the user before proceeding.

---

## Phase 1 — Pre-flight Checks

Run in order — if any fails, STOP and surface to the user:

1. `pnpm nx lint mobile mobile-ui` — lint clean.
2. `pnpm nx test mobile mobile-ui` — tests pass.
3. `pnpm nx run mobile:test --watchAll=false` — coverage thresholds met.
4. **For `build` and `build-and-submit`**: confirm `version` in `app.config.ts` was bumped if native deps changed.
5. **For `production` channel**: confirm `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN` (and store secrets if submit) are set in GitHub Actions secrets.

---

## Phase 2 — Trigger the Workflow

Use the GitHub CLI:

```bash
gh workflow run "CD: Mobile Deploy" \
  --field action={action} \
  --field profile={profile} \
  --field platform={platform} \
  --field message="{message}"
```

Then watch:
```bash
gh run watch
```

---

## Phase 3 — Post-Release Verification

### For `update` (OTA)

1. Open the EAS dashboard → Updates → confirm the new update appears under the target branch.
2. On a test device, open the app twice (first open triggers download, second uses the new bundle).
3. Verify Sentry receives a new release marker.

### For `build`

1. Wait for the EAS build to complete (workflow returns immediately due to `--no-wait`; use `eas build:list` or the EAS dashboard to monitor).
2. Install the resulting binary via the dashboard's QR code.
3. Smoke-test sign-in, navigation, and any feature affected by the build.

### For `build-and-submit` (production)

1. Wait for build completion.
2. Wait for store-side processing:
   - **iOS**: TestFlight processing (~30 min). Promote to public review when ready.
   - **Android**: Internal track build appears immediately. Promote up the tracks (closed → open → production).
3. Tag the release commit:
```bash
git tag mobile-v{version}
git push origin mobile-v{version}
```

---

## Phase 4 — Rollback (if release fails)

### OTA rollback

`eas update:republish --branch {channel} --update-id {previous_update_id}`

This re-publishes the previous update under the same branch — devices roll back on next open.

### Binary rollback

There is no fast rollback for native binaries. Either:
- Push a hotfix OTA on the same `runtimeVersion`.
- Submit a new binary with the bug fixed.

---

## Final Verification

- EAS dashboard shows expected status.
- Sentry shows the new release with no spike in errors.
- Test device(s) on the target channel see the change.

Surface any anomalies to the user before claiming done.
