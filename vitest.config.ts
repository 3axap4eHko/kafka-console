import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.ts'],
    exclude: ['src/**/__tests__/**/*.e2e.ts'],
    alias: {
      '@platformatic/kafka': new URL('./src/__mocks__/@platformatic/kafka.ts', import.meta.url).pathname,
      'commander': new URL('./src/__mocks__/commander.ts', import.meta.url).pathname,
    },
    coverage: {
      enabled: !!process.env.CI || !!process.env.COVERAGE,
      include: ['src/**/*.ts'],
      exclude: ['src/__mocks__/**', 'src/**/__tests__/**'],
    },
  },
});
