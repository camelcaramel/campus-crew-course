import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**', 'generated/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ['test/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
