'use strict';

/**
 * opencode plugin hooks for Maestro.
 *
 * Runs the runtime-agnostic hook logic in-process. The thin ESM entry
 * (opencode/plugins/maestro.js) locates this file and calls createOpencodeHooks.
 *
 * Mapping to the shared hook contract:
 *   session.created / session.deleted -> session-start / session-end
 *   tool.execute.before (task)        -> before-agent (active-session context)
 *   tool.execute.after  (task)        -> after-agent  (handoff report validation)
 *   tool.execute.before (bash)        -> command policy (DENY rules block)
 *   shell.env                         -> exports MAESTRO_EXTENSION_PATH to shell commands
 *
 * opencode has no per-call confirmation hook, so ASK rules (redirects, tee)
 * are advisory only; DENY rules are enforced by throwing.
 */

const { handleSessionStart } = require('./logic/session-start-logic');
const { handleSessionEnd } = require('./logic/session-end-logic');
const { handleBeforeAgent } = require('./logic/before-agent-logic');
const { handleAfterAgent } = require('./logic/after-agent-logic');
const { checkCommand } = require('../core/command-policy');

const TASK_TOOL = 'task';
const BASH_TOOL = 'bash';

function safely(fn) {
  try {
    return fn();
  } catch (_) {
    // Hook bookkeeping must never break the host session.
    return null;
  }
}

/**
 * @param {{ directory: string, extensionRoot: string }} options
 * @returns {object} opencode Hooks
 */
function createOpencodeHooks({ directory, extensionRoot }) {
  process.env.MAESTRO_QUIET = '1';
  const retriedSessions = new Set();

  return {
    'shell.env': async (_input, output) => {
      output.env.MAESTRO_EXTENSION_PATH = extensionRoot;
      output.env.MAESTRO_RUNTIME = 'opencode';
    },

    event: async ({ event }) => {
      const sessionId = event && event.properties && event.properties.info && event.properties.info.id;
      if (!sessionId) return;
      if (event.type === 'session.created') {
        safely(() => handleSessionStart({ sessionId, cwd: directory }));
      } else if (event.type === 'session.deleted') {
        retriedSessions.delete(sessionId);
        safely(() => handleSessionEnd({ sessionId }));
      }
    },

    'tool.execute.before': async (input, output) => {
      if (input.tool === BASH_TOOL) {
        let verdict;
        try {
          verdict = checkCommand((output.args && output.args.command) || '');
        } catch (_) {
          throw new Error('Maestro policy blocked this command: policy enforcer internal error');
        }
        if (verdict.decision === 'block') {
          throw new Error(`Maestro policy blocked this command: ${verdict.reason}`);
        }
        return;
      }

      if (input.tool === TASK_TOOL && output.args) {
        const result = safely(() => handleBeforeAgent({
          sessionId: input.sessionID,
          cwd: directory,
          event: 'tool.execute.before',
          agentName: output.args.subagent_type || null,
          agentInput: output.args.prompt || null,
        }));
        if (result && result.message && typeof output.args.prompt === 'string') {
          output.args.prompt = `${output.args.prompt}\n\n[Maestro] ${result.message}`;
        }
      }
    },

    'tool.execute.after': async (input, output) => {
      if (input.tool !== TASK_TOOL) return;
      const result = safely(() => handleAfterAgent({
        sessionId: input.sessionID,
        agentResult: typeof output.output === 'string' ? output.output : '',
        stopHookActive: retriedSessions.has(input.sessionID),
      }));
      if (result && result.action === 'deny') {
        retriedSessions.add(input.sessionID);
        output.output = `${output.output || ''}\n\n[Maestro handoff validation] ${result.reason}`;
      } else {
        retriedSessions.delete(input.sessionID);
      }
    },
  };
}

module.exports = { createOpencodeHooks };
