---
name: mobile-app-icon-splash
description: Configure the mobile app icon, adaptive icon (Android), and splash screen via Expo. Use this when branding the app for a new project, swapping placeholder assets, or adjusting the splash screen behavior.
---

# Mobile — App Icon & Splash Screen

The mobile app uses Expo's static asset pipeline for icons and the `expo-splash-screen` plugin for the launch screen.

## Asset Locations

All branding assets live under `apps/mobile/assets/images/`:

| File | Purpose | Required size |
|---|---|---|
| `icon.png` | App icon (iOS + Android non-adaptive) | 1024×1024 PNG |
| `adaptive-icon.png` | Android adaptive icon foreground | 1024×1024 PNG (with safe area) |
| `splash-icon.png` | Splash screen foreground image | 200×200 logo (transparent BG) |
| `favicon.png` | Web bundler favicon | 48×48 PNG |

The current files are placeholders. **Replace them with branded assets before any production build.**

## Configuration

All references live in `apps/mobile/app.config.ts`:

```ts
icon: './assets/images/icon.png',
android: {
  adaptiveIcon: {
    foregroundImage: './assets/images/adaptive-icon.png',
    backgroundColor: '#ffffff',
  },
},
plugins: [
  ['expo-splash-screen', {
    image: './assets/images/splash-icon.png',
    imageWidth: 200,
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  }],
],
```

## Splash Screen Behaviour

The native splash is shown until JS hides it. `_layout.tsx` calls:
```ts
SplashScreen.preventAutoHideAsync(); // hold splash
// ...
useEffect(() => {
  SplashScreen.hideAsync(); // release after JS root mounts
}, []);
```

This avoids the **flash of unstyled content** (FOUC) where the user briefly sees a blank screen between the native splash and the first JS render.

## When to Read This Skill

- Replacing placeholder branding for a new project.
- Adjusting splash colors or timing.
- Adding a dark-mode adaptive icon.

## Rules

1. **Never block the splash on a network call.** `SplashScreen.hideAsync()` must run after the synchronous mount or a fixed-timeout (≤500ms) — never gated on `useUsers()` or auth refresh.
2. **`backgroundColor` must match in `app.config.ts` and the splash image** so there's no visible seam during transition.
3. **Adaptive icon must include a 264px diameter safe area** in the centre — Android masks vary by launcher.
4. **Bump the version** in `app.config.ts` whenever you ship a new icon. iOS aggressively caches app icons across builds with the same version.

## Verifying Locally

```bash
pnpm nx run mobile:serve
# Open the dev client. Splash should appear briefly then transition to the app.
```

For native binary verification:
```bash
pnpm nx run mobile:eas-build -- --profile preview --platform ios --local
```

## Common Pitfalls

| Symptom | Cause |
|---|---|
| Splash screen sticks for 5+ seconds | `SplashScreen.hideAsync()` is gated on a slow promise. Move it behind a fixed timeout. |
| Icon doesn't update after rebuild | iOS icon cache. Bump version, delete app from device, reinstall. |
| Adaptive icon is cropped on Android | Foreground image doesn't honour the 264px safe area. |
| Splash background flickers white | `backgroundColor` doesn't match between `app.config.ts` and image bg. |
