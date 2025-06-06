module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/examples'],
  testMatch: [
    '**/__tests__/**/*.ts', 
    '**/?(*.)+(spec|test).ts',
    '!**/packages/tests/src/integration/**'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }],
  },
  // Handle ES modules from jose and other dependencies
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'packages/**/*.ts',
    'examples/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/packages/tests/src/integration/**'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 10000,
}; 