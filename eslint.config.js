import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const ro = (names) => Object.fromEntries(names.map((n) => [n, 'readonly']));

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/api/drizzle/**',
      'data/**',
      'e2e/**',
      'apps/desktop/stage/**',
      'apps/desktop/release/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Scripts Node (launcher e testes): globais do ambiente Node.
    files: ['scripts/**/*.mjs', 'apps/desktop/*.{mjs,cjs}'],
    languageOptions: {
      globals: ro([
        'process',
        'console',
        'URL',
        'Buffer',
        'setTimeout',
        'fetch',
        '__dirname',
        'require',
      ]),
    },
  },
  {
    // Service worker: roda no navegador, num escopo próprio (self/caches/clients).
    files: ['apps/web/public/sw.js'],
    languageOptions: { globals: ro(['self', 'caches', 'fetch', 'URL']) },
  },
  {
    // Processo principal do Electron: CommonJS por exigência do Electron.
    files: ['apps/desktop/main.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
