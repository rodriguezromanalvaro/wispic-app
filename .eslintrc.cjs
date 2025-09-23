/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'eslint-config-prettier',
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    'web-build',
    '.expo',
    'android',
    'ios'
  ],
};
