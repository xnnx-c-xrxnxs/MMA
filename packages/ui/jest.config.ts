import type { Config } from 'jest';

// React Testing Library requires React's development build (act() is a no-op
// otherwise). Setting NODE_ENV early avoids "act() is not supported" warnings.
process.env.NODE_ENV = 'test';

const config: Config = {
  displayName: 'ui',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Stub stylesheet imports — Storybook preview CSS isn't relevant in tests.
    '\\.(css|scss)$': '<rootDir>/src/__mocks__/style-mock.js',
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.storybook/'],
  coverageDirectory: '../../coverage/packages/ui',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.ts',
    '!src/__mocks__/**',
    '!src/test-setup.ts',
    // Pure-data / type-only modules — no executable branches to cover.
    '!src/lib/tokens.ts',
    '!src/icons/icon.types.ts',
    '!src/icons/icons.tsx',
    '!src/lib/utils.ts',
  ],
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
