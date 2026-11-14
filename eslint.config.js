import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import functionName from 'eslint-plugin-function-name';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

import boundariesConfig from './eslint.boundaries.js';

export default defineConfig([
  globalIgnores([
    'dist/**',
    'dist-ssr/**',
    'coverage/**',
    'build/**',
    '**/*.min.js',
  ]),
  boundariesConfig,
  {
    files: ['**/*.{js,ts}'],
    plugins: { 'import-x': importX, 'function-name': functionName },
    rules: {
      'import-x/no-duplicates': 'error',
      'function-name/starts-with-verb': 'error',
    },
  },
  {
    files: ['**/*.{js,ts}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: 'multiline-expression', next: '*' },
        {
          blankLine: 'always',
          prev: [
            'interface',
            'type',
            {
              selector:
                'ExportNamedDeclaration[declaration.type="TSInterfaceDeclaration"]',
            },
            {
              selector:
                'ExportNamedDeclaration[declaration.type="TSTypeAliasDeclaration"]',
            },
            {
              selector:
                'ExportDefaultDeclaration[declaration.type="TSInterfaceDeclaration"]',
            },
          ],
          next: '*',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,ts}'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': 'error',
      'unicorn/name-replacements': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          enforceConst: true,
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message: 'Use textContent and createElement for dynamic content.',
        },
        {
          property: 'outerHTML',
          message: 'Use textContent and createElement for dynamic content.',
        },
        {
          property: 'insertAdjacentHTML',
          message: 'Use textContent and createElement for dynamic content.',
        },
        {
          object: 'document',
          property: 'write',
          message: 'Use textContent and createElement for dynamic content.',
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts', 'src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'AbortController',
          message: 'Use an application-owned cancellation contract.',
        },
        {
          name: 'AbortSignal',
          message: 'Use an application-owned cancellation contract.',
        },
        {
          name: 'DOMException',
          message: 'Translate platform errors in Infrastructure.',
        },
        { name: 'document', message: 'DOM access belongs in Presentation.' },
        { name: 'window', message: 'Browser globals belong in outer layers.' },
        { name: 'fetch', message: 'Network access belongs in Infrastructure.' },
        {
          name: 'localStorage',
          message: 'Storage access belongs in Infrastructure.',
        },
        {
          name: 'sessionStorage',
          message: 'Storage access belongs in Infrastructure.',
        },
        {
          name: 'setTimeout',
          message: 'Inject scheduling through an application port.',
        },
        {
          name: 'clearTimeout',
          message: 'Inject scheduling through an application port.',
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: false,
          allowHigherOrderFunctions: false,
          allowDirectConstAssertionInArrowFunctions: false,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'VariableDeclarator:not([init.type="ArrowFunctionExpression"]):not([init.type="FunctionExpression"]):not([init.type="TSAsExpression"][init.typeAnnotation.typeName.name="const"]) > :matches(Identifier, ObjectPattern, ArrayPattern).id:not([typeAnnotation])',
          message:
            'Add an explicit type annotation to every data binding; function bindings use their signature.',
        },
        {
          selector:
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > :matches(Identifier, ObjectPattern, ArrayPattern).params:not([typeAnnotation])',
          message: 'Add an explicit type annotation to every parameter.',
        },
        {
          selector:
            'AssignmentPattern.params > :matches(Identifier, ObjectPattern, ArrayPattern).left:not([typeAnnotation])',
          message: 'Add an explicit type annotation to default parameters.',
        },
        {
          selector:
            'TSAsExpression:not([typeAnnotation.typeName.name="const"])',
          message:
            'Only `as const` assertions are allowed for literal configuration objects.',
        },
        {
          selector: 'RestElement.params:not([typeAnnotation])',
          message: 'Add an explicit type annotation to rest parameters.',
        },
      ],
    },
  },
  prettier,
]);
