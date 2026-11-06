// BillKit lint configuration — © 2026 Shaik Gouse Kareem. All rights reserved.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/dist-ssr/**', '**/playwright-report/**', '**/test-results/**', 'training/**', '**/.venv/**', 'website/public/sw.js', 'presentation/**'] /* presentation/build_deck.cjs is a standalone CommonJS generator */ },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Indic-script ranges (\u0900-\u0dff) intentionally include combining vowel signs.
      'no-misleading-character-class': 'off',
    },
  },
  {
    files: ['website/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  { files: ['**/tests/**', '**/e2e/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
