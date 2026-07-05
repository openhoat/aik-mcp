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
    },
  },
})
