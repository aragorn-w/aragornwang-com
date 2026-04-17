// ESLint v10 flat config. Spec §3 originally listed `.eslintrc.cjs` (eslintrc legacy);
// flat config is the only supported format in eslint v9+.

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'playwright-report/', 'test-results/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Browser-shipped sources.
  {
    files: ['src/**/*.{ts,astro}'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        matchMedia: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        Event: 'readonly',
      },
    },
  },
  // Node scripts. The verify harnesses also use Playwright `page.evaluate(() => …)`
  // which references browser globals lexically — eslint can't follow that across the
  // function boundary, so we declare both global sets here.
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        matchMedia: 'readonly',
      },
    },
  },
];
