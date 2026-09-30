'use strict';

// SAST gate: eslint-plugin-security over shipped code (tests excluded).
const globals = require('globals');
const security = require('eslint-plugin-security');
const { GENERATED } = require('./eslint.config');

module.exports = [
  { ignores: GENERATED },
  {
    files: [
      'src/**/*.js',
      'scripts/**/*.js',
      'bin/**/*.js',
      'hooks/**/*.js',
      'mcp/**/*.js',
      'claude/scripts/**/*.js',
      'claude/mcp/**/*.js',
      'opencode/plugins/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      // Justified exclusions: the CLI and generators build paths, requires and
      // regexes from repo-relative data or static registries (agent, runtime and
      // skill names), never from untrusted input, so these rules only add noise.
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-require': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  {
    files: ['opencode/plugins/*.js'],
    languageOptions: { sourceType: 'module' },
  },
];
