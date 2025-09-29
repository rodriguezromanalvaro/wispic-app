// eslint.config.cjs (Flat Config para ESLint v9)

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  // Ignora SOLO lo que no queremos lintar
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'build/**',
      'android/**',
      'ios/**',
      '**/*.d.ts',
      // ficheros sueltos que no queremos lintar
      '_ctx*.js',
      'app.plugin.js',
    ],
  },

  // Reglas para nuestro código fuente
  {
    files: [
      'app/**/*.ts',
      'app/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.tsx',
      'lib/**/*.ts',
      'lib/**/*.tsx',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      globals: {
        // Evita falsos positivos de "no-undef" en RN/JS
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // RN/TS: apagamos no-undef (lo suple TS)
      'no-undef': 'off',

      // React 17+: no hace falta importar React en cada archivo
      'react/react-in-jsx-scope': 'off',

      // Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Unused vars: permite _prefijo para “intencionadamente no usado”
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
