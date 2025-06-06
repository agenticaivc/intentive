import { vi, beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Freeze time for deterministic tests across platforms
  vi.useFakeTimers();
  vi.setSystemTime('2024-12-15T12:00:00Z');
});

afterAll(() => {
  // CRITICAL: Prevent side-effects in watch mode
  vi.useRealTimers();
  performance.clearMarks();
  performance.clearMeasures();
}); 