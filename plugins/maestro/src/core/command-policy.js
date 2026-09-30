'use strict';

/**
 * Shell command policy evaluation shared by the Claude Code policy-enforcer
 * hook and the opencode plugin. Splits a command line into simple commands
 * (including $(...) and backtick subshells) and checks each against the
 * canonical DENY/ASK rules from policy-rules.js.
 */

const { DENY_RULES, ASK_RULES } = require('./policy-rules');

function splitCommands(command) {
  const parts = [];
  let depth = 0;
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; current += ch; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; current += ch; continue; }

    if (!inSingle && ch === '$' && command[i + 1] === '(') {
      const parsed = readDollarSubshell(command, i + 2);
      current += '$(' + parsed.content + ')';
      i = parsed.end;
      continue;
    }
    if (!inSingle && ch === '`') {
      const parsed = readBacktickSubshell(command, i + 1);
      current += '`' + parsed.content + '`';
      i = parsed.end;
      continue;
    }

    if (inSingle || inDouble) {
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '{') { depth++; current += ch; continue; }
    if (ch === ')') {
      if (depth > 0) {
        depth--;
      }
      current += ch;
      continue;
    }
    if (ch === '}') { depth--; current += ch; continue; }

    if (depth === 0) {
      if (ch === ';') {
        parts.push(current);
        current = '';
        continue;
      }
      if (ch === '&' && command[i + 1] === '&') {
        parts.push(current);
        current = '';
        i++;
        continue;
      }
      if (ch === '|' && command[i + 1] === '|') {
        parts.push(current);
        current = '';
        i++;
        continue;
      }
      if (ch === '|') {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function readBacktickSubshell(command, startIndex) {
  let content = '';

  for (let i = startIndex; i < command.length; i++) {
    const ch = command[i];
    if (ch === '\\') {
      const next = command[i + 1];
      if (next === '`') {
        content += '`';
        i++;
        continue;
      }
      content += ch;
      continue;
    }
    if (ch === '`') {
      return { content, end: i };
    }
    content += ch;
  }

  throw new Error('Unterminated backtick command substitution');
}

function readDollarSubshell(command, startIndex) {
  let content = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = startIndex; i < command.length; i++) {
    const ch = command[i];

    if (escaped) {
      content += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      if (command[i + 1] === '`') {
        content += '`';
        i++;
        continue;
      }
      content += ch;
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      content += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      content += ch;
      continue;
    }
    if (inSingle) {
      content += ch;
      continue;
    }
    if (ch === '$' && command[i + 1] === '(') {
      const parsed = readDollarSubshell(command, i + 2);
      content += '$(' + parsed.content + ')';
      i = parsed.end;
      continue;
    }
    if (ch === '`') {
      const parsed = readBacktickSubshell(command, i + 1);
      content += '`' + parsed.content + '`';
      i = parsed.end;
      continue;
    }
    if (!inSingle && ch === ')') {
      return { content, end: i };
    }

    content += ch;
  }

  throw new Error('Unterminated $(...) command substitution');
}

function extractSubshells(command) {
  const patterns = [];
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle) continue;

    if (ch === '$' && command[i + 1] === '(') {
      const parsed = readDollarSubshell(command, i + 2);
      const content = parsed.content.trim();
      if (content) {
        patterns.push(content, ...extractSubshells(content));
      }
      i = parsed.end;
      continue;
    }

    if (ch === '`') {
      const parsed = readBacktickSubshell(command, i + 1);
      const content = parsed.content.trim();
      if (content) {
        patterns.push(content, ...extractSubshells(content));
      }
      i = parsed.end;
    }
  }

  return patterns;
}

function matchRule(rule, command) {
  const trimmed = command.trimStart();
  switch (rule.matchType) {
    case 'prefix':
      return trimmed.startsWith(rule.pattern);
    case 'regex':
      return new RegExp(rule.pattern).test(trimmed);
    case 'word':
      return new RegExp('\\b' + rule.pattern + '\\b').test(trimmed);
    default:
      return false;
  }
}

/**
 * @param {string} command - Full shell command line
 * @returns {{ decision: 'block'|'ask'|'approve', reason?: string }}
 * @throws {Error} On unterminated command substitutions
 */
function checkCommand(command) {
  const segments = splitCommands(command);
  const subshells = extractSubshells(command);
  const allParts = [...new Set([...segments, ...subshells, ...subshells.flatMap((s) => splitCommands(s))])];

  for (const part of allParts) {
    for (const rule of DENY_RULES) {
      if (matchRule(rule, part)) {
        return { decision: 'block', reason: rule.reason };
      }
    }
  }
  for (const part of allParts) {
    for (const rule of ASK_RULES) {
      if (matchRule(rule, part)) {
        return { decision: 'ask', reason: rule.reason };
      }
    }
  }
  return { decision: 'approve' };
}

module.exports = { checkCommand, splitCommands };
