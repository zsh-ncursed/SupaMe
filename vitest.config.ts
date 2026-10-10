import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts?(x)'],
    globals: false,
    restoreMocks: true,
    clearMocks: true,
    alias: {
      // Нативный konva тянет node-canvas, недоступный в CI — в тестах достаточно
      // констант фильтров (см. src/test/mocks/konva.ts).
      konva: fileURLToPath(new URL('./src/test/mocks/konva.ts', import.meta.url)),
    },
  },
  esbuild: { target: 'es2022' },
});
