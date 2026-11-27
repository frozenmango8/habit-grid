import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/habit-grid/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
