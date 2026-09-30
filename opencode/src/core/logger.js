'use strict';

function log(level, message) {
  // In-process hosts (the opencode plugin) set MAESTRO_QUIET so hook logging
  // does not write into the host's terminal UI.
  if (process.env.MAESTRO_QUIET === '1') return;
  process.stderr.write(`[${level}] maestro: ${message}\n`);
}

function fatal(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

module.exports = { log, fatal };
