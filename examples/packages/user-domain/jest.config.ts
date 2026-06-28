import type { Config } from 'jest';

const config: Config = {
  displayName: 'user-domain',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      useESM: false,
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/packages/user-domain',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
  ],
  // Separate integration tests for explicit runs
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.spec\\.ts$',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Support for dynamodb-onetable ESM modules
  transformIgnorePatterns: [
    'node_modules/(?!(dynamodb-onetable)/)',
  ],
};

export default config;
