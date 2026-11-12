import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import importX from 'eslint-plugin-import-x';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', 'dist-ssr/**', 'coverage/**']),
  {
    files: ['**/*.{js,ts}'],
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-duplicates': 'error',
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
