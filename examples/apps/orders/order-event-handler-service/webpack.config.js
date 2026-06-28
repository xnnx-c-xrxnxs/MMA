const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@opentelemetry/api': require.resolve('@opentelemetry/api'),
    },
  },
  output: {
    path: join(__dirname, '../../../dist/apps/orders/order-event-handler-service'),
    libraryTarget: 'commonjs2',
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  ignoreWarnings: [
    {
      module: /packages[\\/]order-domain[\\/]src[\\/]infrastructure[\\/]generated/,
      message: /Failed to parse source map/,
    },
  ],
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/assets',
        {
          input: '../../../packages/order-domain/src/infrastructure/generated/client',
          glob: 'libquery_engine-linux-arm64-openssl-3.0.x.so.node',
          output: '.',
        },
        {
          input: '../../../packages/order-domain/src/infrastructure/generated/client',
          glob: 'schema.prisma',
          output: '.',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
