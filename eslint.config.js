'use strict';

const js = require('@eslint/js');
const globals = require('globals');

// Generated runtime payloads and outputs are linted through src/.
const GENERATED = [
  'claude/src/**',
  'plugins/maestro/src/**',
  'opencode/src/**',
  'coverage/**',
  'dist/**',
  'node_modules/**',
];

module.exports = [
  { ignores: GENERATED },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // The opencode plugin entry is ESM (opencode loads local plugins as ES modules).
    files: ['opencode/plugins/*.js'],
    languageOptions: { sourceType: 'module' },
  },
];

module.exports.GENERATED = GENERATED;
