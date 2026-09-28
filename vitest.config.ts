import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    env: {
      LOG_LEVEL: 'silent',
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text', 'text-summary'],
      include: ['src/**/*.ts'],
      reportsDirectory: 'dist/coverage',
      thresholds: {
        lines: 75,
        functions: 60,
        branches: 65,
        statements: 75,
      },
    },
  },
})
