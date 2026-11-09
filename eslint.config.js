import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const ro = (names) => Object.fromEntries(names.map((n) => [n, 'readonly']));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/drizzle/**', 'data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Scripts Node (launcher e testes): globais do ambiente Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: ro(['process', 'console', 'URL', 'Buffer', 'setTimeout']) },
  },
  {
    // Service worker: roda no navegador, num escopo próprio (self/caches/clients).
    files: ['apps/web/public/sw.js'],
    languageOptions: { globals: ro(['self', 'caches', 'fetch', 'URL']) },
  },
);
