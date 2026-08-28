import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Electron is confined to apps/desktop (plan.md "Structure Decision"). Every
// other package is presentation- and runtime-independent, so importing
// `electron` there is a boundary violation, not a style nit.
const electronBoundary = {
  files: ['packages/**/*.ts', 'native/**/*.ts', 'tests/unit/**/*.ts', 'tests/contract/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'electron', message: 'Electron imports are allowed only inside apps/desktop.' },
        ],
        patterns: ['electron/*'],
      },
    ],
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/out/',
      '**/.tsbuild/',
      '**/coverage/',
      '**/target/',
      '**/*.node',
      'native/windows-supervisor/index.js',
      'native/windows-supervisor/index.d.ts',
      '.specify/',
      '.agents/',
      '.claude/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  electronBoundary,
);
