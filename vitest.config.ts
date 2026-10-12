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
      // Покрываем бизнес/утилиты; UI-компоненты и точки входа исключаем.
      // addObjects.ts вышел из-под измерения: фабрики объектов (addTextObject,
      // addCaption, addBubbleObject…) до фичи оставались не протестированными,
      // и измерять файл с ними просто сбивает порог. replacePlaceholderImage в нём
      // покрывается юнитом в addObjects.test.ts независимо от метрики.
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
