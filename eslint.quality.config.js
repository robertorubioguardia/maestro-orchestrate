'use strict';

// Quality gate: cyclomatic complexity ceiling for shipped code. 36 is the current
// maximum (scripts/release-artifact-manifest.js); ratchet it down over time.
const globals = require('globals');
const { GENERATED } = require('./eslint.config');

module.exports = [
  { ignores: GENERATED },
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'bin/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: { complexity: ['error', 36] },
  },
];
