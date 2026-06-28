import type { Config } from 'jest';

// Ensure React development builds are loaded (act() is not available in production builds)
process.env.NODE_ENV = 'test';

const config: Config = {
  displayName: 'client-common',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  coverageDirectory: '../../coverage/packages/client-common',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.tsx'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
