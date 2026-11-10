import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';

export default [
  js.configs.recommended,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'public/**',
      'scripts/**',
      'supabase/**',
      'qa/**',
      'tests/**',
      '*.config.mjs',
      '*.config.js'
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [
            ['@babel/preset-react', { runtime: 'automatic' }],
            ['@babel/preset-typescript', { ignoreExtensions: true }]
          ]
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLFormElement: 'readonly',
        React: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off', // TypeScript handles type and interface checking
      'no-undef': 'off', // TypeScript handles global and module resolution
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      'no-constant-condition': 'warn',
    },
  },
];
