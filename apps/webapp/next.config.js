//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// Bundle analyzer — only active when ANALYZE=true. Outputs to
// apps/webapp/.next/analyze/ on next build.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // Static export — produces apps/webapp/out/ for S3 + CloudFront deployment.
  output: 'export',
  transpilePackages: [
    '@mma/contracts-common',
    '@mma/contracts-auth',
  ],
};

const plugins = [withNx, withBundleAnalyzer];

module.exports = composePlugins(...plugins)(nextConfig);
