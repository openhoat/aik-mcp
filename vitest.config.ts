import { defineConfig } from 'vitest/config'

/**
 * Two test projects:
 *  - unit  -> src/** /*.unit.test.ts          (pure/fast, mocked deps)
 *  - e2e   -> src/test/e2e/** /*.e2e.test.ts  (real child process + disk)
 *
 * Default `vitest run` (scripts `test` / `test:coverage`) runs BOTH, keeping the
 * validate gate comprehensive. Filter on demand with `vitest run --project unit`
 * or `vitest run --project e2e` (scripts `test:unit` / `test:e2e`).
 */
const shared = {
  globals: true,
  environment: 'node',
  setupFiles: ['./vitest.setup.ts'],
  testTimeout: 30000,
}

export default defineConfig({
  test: {
    projects: [
      { test: { ...shared, name: 'unit', include: ['src/**/*.unit.test.ts'] } },
      {
        test: {
          ...shared,
          name: 'e2e',
          include: ['src/test/e2e/**/*.e2e.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/helpers.ts'],
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
