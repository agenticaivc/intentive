import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['packages/tests/src/setup.ts'],
    bail: 1, // Fail-fast for CI efficiency
    include: ['packages/tests/src/**/*.test.ts'], // Include tests from packages/tests/src
    exclude: ['node_modules/**', 'dist/**', 'packages/*/tests/**'], // Exclude other package tests
    coverage: {
      provider: 'v8',
      include: ['packages/executor/src/**', 'packages/guards/src/**'], // Focus coverage
      thresholds: {
        lines: 80,        // Realistic for integration tests
        branches: 80,
        functions: 80,
        statements: 80
      }
    }
  }
}); 