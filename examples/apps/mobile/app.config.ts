import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config — env-driven so we can build per-channel without forking app.json.
 *
 * APP_ENV controls bundle identifier suffix, app name, and runtime config.
 * Set automatically by `eas build --profile {dev|preview|prod}` via the `env` block in eas.json.
 */
type AppEnv = 'development' | 'preview' | 'production';

const APP_ENV = (process.env.APP_ENV as AppEnv) ?? 'development';

const NAME_BY_ENV: Record<AppEnv, string> = {
  development: 'OldST (Dev)',
  preview: 'OldST (Preview)',
  production: 'OldST',
};

const BUNDLE_SUFFIX: Record<AppEnv, string> = {
  development: '.dev',
  preview: '.preview',
  production: '',
};

const BASE_BUNDLE_ID = 'com.oldst.mobile';

const UNIVERSAL_LINK_DOMAIN_BY_ENV: Record<AppEnv, string | undefined> = {
  development: process.env.UNIVERSAL_LINK_DOMAIN_DEV,
  preview: process.env.UNIVERSAL_LINK_DOMAIN_PREVIEW,
  production: process.env.UNIVERSAL_LINK_DOMAIN_PROD,
};

const universalLinkDomain = UNIVERSAL_LINK_DOMAIN_BY_ENV[APP_ENV];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME_BY_ENV[APP_ENV],
  slug: 'mobile',
  version: '1.0.0',
  // EAS expects a `runtimeVersion` for OTA updates. Using `appVersion` policy
  // ties OTA compatibility to the native binary version — safe default.
  runtimeVersion: { policy: 'appVersion' },
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'oldst',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: `${BASE_BUNDLE_ID}${BUNDLE_SUFFIX[APP_ENV]}`,
    // Universal Links — requires apple-app-site-association at https://{domain}/.well-known/apple-app-site-association
    associatedDomains: universalLinkDomain
      ? [`applinks:${universalLinkDomain}`]
      : undefined,
  },
  android: {
    package: `${BASE_BUNDLE_ID.replace(/\./g, '_')}${BUNDLE_SUFFIX[APP_ENV].replace(
      /\./g,
      '_',
    )}`,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    // App Links — requires assetlinks.json at https://{domain}/.well-known/assetlinks.json
    intentFilters: universalLinkDomain
      ? [
          {
            action: 'VIEW',
            autoVerify: true,
            data: [{ scheme: 'https', host: universalLinkDomain }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ]
      : undefined,
  },
  web: {
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
    'expo-router',
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
    apiUserUrl: process.env.EXPO_PUBLIC_API_USER_URL,
    apiProductUrl: process.env.EXPO_PUBLIC_API_PRODUCT_URL,
    apiOrderUrl: process.env.EXPO_PUBLIC_API_ORDER_URL,
    apiAuthUrl: process.env.EXPO_PUBLIC_API_AUTH_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  updates: {
    url: process.env.EAS_UPDATE_URL,
  },
});
