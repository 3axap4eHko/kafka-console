import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-plugin-prettier';

export default defineConfig(
  globalIgnores(['**/docs', '**/build', '**/coverage', '**/node_modules', '**/scripts', '**/*.tmp.ts', '**/__tests__/*', '**/__bench__/*', '**/__mocks__/*', '**/e2e/*', 'vitest.config*.ts', '**/*.js', '**/*.cjs', '**/*.mjs']),
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    plugins: {
      prettier,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prettier/prettier': 2,
      '@typescript-eslint/no-unused-vars': 2,
      '@typescript-eslint/ban-ts-comment': 1,
      '@typescript-eslint/await-thenable': 1,
      '@typescript-eslint/no-floating-promises': 1,
      '@typescript-eslint/ban-types': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/require-await': 0,
      '@typescript-eslint/no-misused-promises': 0,
      '@typescript-eslint/no-empty-object-type': 0,
      '@typescript-eslint/no-unsafe-declaration-merging': 0,
      '@typescript-eslint/prefer-promise-reject-errors': 0,
    },
  },
);
