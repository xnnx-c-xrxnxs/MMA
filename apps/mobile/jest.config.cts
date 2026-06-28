/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFiles: ['<rootDir>/src/test-env-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '\\.svg$': '@nx/expo/plugins/jest/svg-mock',
    '^@mma/contracts/common$': '<rootDir>/../../packages/contracts/common/src/index.ts',
    '^@mma/contracts/auth$': '<rootDir>/../../packages/contracts/auth/src/index.ts',
    '^@mma/mobile-ui$': '<rootDir>/../../packages/mobile-ui/src/index.ts',
    '^@mma/client-common$': '<rootDir>/../../packages/client-common/src/index.ts',
    '^@mma/client-common/hooks$': '<rootDir>/../../packages/client-common/src/hooks/index.ts',
    '^@mma/client-common/infrastructure$': '<rootDir>/../../packages/client-common/src/infrastructure/index.ts',
  },
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
      require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
  },
  coverageDirectory: '../../coverage/apps/mobile',
  passWithNoTests: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
