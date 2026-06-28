//@ts-check
const path = require('path');
const { composePlugins, withNx } = require('@nx/next');

// `output: 'standalone'` requires NTFS symlink permission on Windows (admin or
// Developer Mode). Local devs without it can opt out via NEXT_DISABLE_STANDALONE=true.
// CI / Docker builds keep the default ON — required for the Lambda Web Adapter image.
const standaloneEnabled = process.env.NEXT_DISABLE_STANDALONE !== 'true';

/** @type {import('@nx/next/plugins/with-nx').WithNxOptions} */
const nextConfig = {
  nx: {},
  // Trace from workspace root so pnpm-hoisted deps (styled-jsx, etc.) are included
  outputFileTracingRoot: path.join(__dirname, '../../../'),
  transpilePackages: ['@mma/monitoring-sdk'],
  // Environment selector is a URL query param — no server-side env branching needed
};

if (standaloneEnabled) {
  nextConfig.output = 'standalone';
}

const plugins = [withNx];
module.exports = composePlugins(...plugins)(nextConfig);
