'use strict';

/**
 * Maestro policy enforcer for Claude Code.
 * Reads stdin (Claude Code PreToolUse hook input for Bash),
 * checks tool_input.command against deny and ask patterns,
 * and outputs a decision JSON to stdout.
 *
 * Command evaluation lives in the canonical source (src/core/command-policy.js)
 * with a fallback to the bundled copy for detached installs.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoPolicy = path.resolve(__dirname, '../../src/core/command-policy.js');
const bundledPolicy = path.resolve(__dirname, '../src/core/command-policy.js');
const { checkCommand } = require(fs.existsSync(repoPolicy) ? repoPolicy : bundledPolicy);

const MAX_STDIN_BYTES = 1024 * 1024;
const chunks = [];
let totalBytes = 0;
process.stdin.on('data', (chunk) => {
  totalBytes += chunk.length;
  if (totalBytes > MAX_STDIN_BYTES) {
    process.stderr.write('Policy enforcer: stdin payload too large\n');
    process.stdout.write(JSON.stringify({ decision: 'block', reason: 'Payload too large' }) + '\n');
    process.exit(1);
  }
  chunks.push(chunk);
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString());
    const command = (input.tool_input && input.tool_input.command) || '';
    const result = checkCommand(command);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    process.stderr.write('Policy enforcer error: ' + err.message + '\n');
    process.stdout.write(JSON.stringify({ decision: 'block', reason: 'Policy enforcer internal error' }) + '\n');
  }
});
