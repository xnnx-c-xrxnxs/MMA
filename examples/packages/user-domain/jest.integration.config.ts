import type { Config } from 'jest';

const config: Config = {
  displayName: 'user-domain-integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      useESM: false,
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: [
    '<rootDir>/src/**/*.integration.spec.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(dynamodb-onetable)/)',
  ],
  testTimeout: 30000, // 30 seconds for DB operations
};

export default config;
