// eslint.config.cjs (Flat Config para ESLint v9)

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const unusedImports = require('eslint-plugin-unused-imports');
const importPlugin = require('eslint-plugin-import');
const boundariesPlugin = require('eslint-plugin-boundaries');

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
      'vendor/**',
      'supabase/**',
      'docs/**',
      'types/**',
      '**/*.d.ts',
      // ficheros sueltos que no queremos lintar
      '_ctx*.js',
      'app.plugin.js',
      // archivo legacy eliminado
    ],
  },

  // Reglas para nuestro código fuente (TypeScript/React Native)
  {
    files: [
      // Raíz del repo (configs TS como tamagui.config.ts, sentry.ts, etc.)
      '*.ts',
      '*.tsx',
      '__tests__/**/*.ts',
      '__tests__/**/*.tsx',
      'app/**/*.ts',
      'app/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.tsx',
      'lib/**/*.ts',
      'lib/**/*.tsx',
      'features/**/*.ts',
      'features/**/*.tsx',
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
      'unused-imports': unusedImports,
      import: importPlugin,
      boundaries: boundariesPlugin,
    },
    settings: {
      react: { version: 'detect' },
      // Resolver para que los alias TS funcionen con reglas de import
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      // Asegura que eslint-plugin-import utilice el parser de TS para .ts/.tsx
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      // Elementos/layers para eslint-plugin-boundaries
      'boundaries/elements': [
        { type: 'app', pattern: 'app/**' },
        { type: 'feature', pattern: 'features/**' },
        { type: 'component', pattern: 'components/**' },
        { type: 'lib', pattern: 'lib/**' },
        // Tipos compartidos y archivos de config en raíz
        { type: 'types', pattern: 'types/**' },
        { type: 'config', pattern: '**/*.config.ts' },
        { type: 'config', pattern: 'tamagui.config.ts' },
        { type: 'config', pattern: 'sentry.ts' },
        { type: 'config', pattern: 'tamagui' },
        { type: 'config', pattern: 'sentry' },
      ],
    },
  rules: {
      // RN/TS: apagamos no-undef (lo suple TS)
      'no-undef': 'off',

      // React 17+: no hace falta importar React en cada archivo
      'react/react-in-jsx-scope': 'off',

    // Hooks: mantener reglas de hooks, pero desactivar deps por ruido hasta refactor
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'off',

      // Unused imports: elimina imports sin uso automáticamente; ignoramos vars no usadas (demasiado ruidoso ahora)
  // Re-enable strict hygiene now that build is stable
  'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Orden y limpieza de imports
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            { pattern: 'react', group: 'external', position: 'before' },
            { pattern: 'react-native', group: 'external', position: 'before' },
            { pattern: 'expo*', group: 'external', position: 'before' },
            { pattern: 'expo/**', group: 'external', position: 'before' },
            { pattern: '{app,features,components,lib}/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],
      // Re-enable cycle detection at shallow depth
      'import/no-cycle': ['error', { maxDepth: 1 }],

  // Evitar imports relativos hacia arriba; preferir alias (app, features, components, lib)
  // Usamos no-restricted-imports para detectar '../' con menos falsos positivos
  'import/no-relative-parent-imports': 'off',
  'no-restricted-imports': [
    'error',
    {
      patterns: ['../*', '../../*', '../../../*', '../../../../*'],
    },
  ],

      // Boundaries: reglas de capas. Subido a 'error' para evitar regresiones de arquitectura.
  'boundaries/no-unknown': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // app puede depender de feature, component, lib; no de app (para evitar imports cruzados raros)
            { from: 'app', disallow: ['app'] },
            // feature puede depender de component y lib; no de app ni de otros feature (reducir acoplamiento)
            { from: 'feature', disallow: ['app', 'feature'] },
            // components no puede depender de app ni features; puede de lib y otros components
            { from: 'component', disallow: ['app', 'feature'] },
            // lib no puede depender de app, features ni components (capa base)
            { from: 'lib', disallow: ['app', 'feature', 'component'] },
          ],
        },
      ],
    },
  },
  // Excepciones específicas para shims de config
  {
    files: ['lib/tamagui.ts', 'lib/sentry.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'boundaries/no-unknown': 'off',
    },
  },
    // Ya no hay excepciones: alias para Tamagui y Sentry eliminan los imports relativos
  // Reglas para scripts/tools Node (sin React/Boundaries)
  {
    files: [
      'scripts/**/*.ts',
      'scripts/**/*.js',
      'node/**/*.ts',
      'node/**/*.js',
      'plugin/**/*.ts',
      'plugin/**/*.js',
      'link/**/*.ts',
      'link/**/*.js',
      'rsc/**/*.ts',
      'rsc/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: { project: ['./tsconfig.json'] },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      'no-undef': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin','external','internal','parent','sibling','index','object','type'],
        },
      ],
      'import/no-cycle': 'off',
      'import/no-relative-parent-imports': 'off',
    },
  },
];
