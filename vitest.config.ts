import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts?(x)'],
    setupFiles: ['src/test/setup.ts'],
    globals: false,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      // Покрываем бизнес/утилиты; UI-компоненты, точки входа и Konva/DOM-обвязку
      // (addObjects/stageCapture) исключаем — для них не подходит юнит-подход без
      // реального canvas/Konva.
      include: ['src/lib/**', 'src/db/**', 'src/store/**'],
      exclude: [
        'src/**/*.test.ts?(x)',
        'src/test/**',
        'src/lib/addObjects.ts',
        'src/lib/stageCapture.ts',
      ],
      reporter: ['text', 'text-summary'],
      // Нижний порог для CI: бизнес-модули должны держать покрытие выше этой
      // отметки (сейчас ~92% стейтментов), иначе прогон падает с ошибкой.
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
    alias: {
      // Нативный konva тянет node-canvas, недоступный в CI — в тестах достаточно
      // констант фильтров (см. src/test/mocks/konva.ts).
      konva: fileURLToPath(new URL('./src/test/mocks/konva.ts', import.meta.url)),
    },
  },
  esbuild: { target: 'es2022' },
});
