// ESLint 9 flat config: TypeScript + React hooks + Prettier-совместимые правила.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    // Node-скрипты десктопной обвязки (desktop/*.mjs) — включаем глобалы Node
    files: ['desktop/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TS сам проверяет необъявленные переменные в проекте
      'no-undef': 'off',
      // Позволительно в x-утилитах вроде dataUrlToBlob
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  }
);
