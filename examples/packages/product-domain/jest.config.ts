import type { Config } from 'jest';

const config: Config = {
  displayName: 'product-domain',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      useESM: false,
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/packages/product-domain',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
  ],
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
};

export default config;
