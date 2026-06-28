const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@opentelemetry/api': require.resolve('@opentelemetry/api'),
    },
  },
  output: {
    path: join(__dirname, '../../../dist/apps/monitoring/monitoring-api-service'),
    libraryTarget: 'commonjs2',
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        {
          input: '../../../.github',
          glob: 'service-registry.json',
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
