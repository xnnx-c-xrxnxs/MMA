//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// Bundle analyzer — only active when ANALYZE=true. Outputs to
// apps/webapp/.next/analyze/ on next build.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// `output: 'standalone'` requires NTFS symlink permission on Windows (admin or
// Developer Mode). Local devs without it can opt out via NEXT_DISABLE_STANDALONE=true.
// CI / Docker builds keep the default ON — required by Golden Rule #40 for the
// Lambda Web Adapter image (apps/webapp/Dockerfile expects .next/standalone/).
const standaloneEnabled = process.env.NEXT_DISABLE_STANDALONE !== 'true';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // Trace from workspace root so pnpm-hoisted deps (styled-jsx, @swc/helpers, etc.) are included
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: [
    '@old-st/contracts-common',
    '@old-st/contracts-user',
    '@old-st/contracts-order',
    '@old-st/contracts-product',
    '@old-st/contracts-auth',
    '@old-st/user-domain',
    '@old-st/order-domain',
    '@old-st/product-domain',
  ],
};

if (standaloneEnabled) {
  nextConfig.output = 'standalone';
}

const plugins = [withNx, withBundleAnalyzer];

module.exports = composePlugins(...plugins)(nextConfig);
