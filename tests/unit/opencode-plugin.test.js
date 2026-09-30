'use strict';

const { describe, it, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// hook-state resolves its base directory at require time, so redirect it first.
const hooksDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-oc-hooks-'));
process.env.MAESTRO_HOOKS_DIR = hooksDir;

const { createOpencodeHooks } = require('../../src/hooks/opencode-plugin');

const SESSION = 'ses_test123';

describe('opencode plugin hooks', () => {
  let workspace;
  let hooks;

  after(() => {
    fs.rmSync(hooksDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-oc-ws-'));
    hooks = createOpencodeHooks({ directory: workspace, extensionRoot: '/opt/maestro' });
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('silences hook logging so the host UI is not written to', () => {
    assert.equal(process.env.MAESTRO_QUIET, '1');
  });

  it('exports the extension path and runtime to shell commands', async () => {
    const output = { env: {} };
    await hooks['shell.env']({ cwd: workspace }, output);
    assert.equal(output.env.MAESTRO_EXTENSION_PATH, '/opt/maestro');
    assert.equal(output.env.MAESTRO_RUNTIME, 'opencode');
  });

  it('blocks denied bash commands by throwing', async () => {
    await assert.rejects(
      hooks['tool.execute.before']({ tool: 'bash', sessionID: SESSION }, { args: { command: 'rm -rf /tmp/x' } }),
      /Maestro policy blocked this command: Recursive force delete/
    );
  });

  it('allows ordinary and ask-rule bash commands', async () => {
    await hooks['tool.execute.before']({ tool: 'bash', sessionID: SESSION }, { args: { command: 'ls -la' } });
    await hooks['tool.execute.before']({ tool: 'bash', sessionID: SESSION }, { args: { command: 'echo hi > out.txt' } });
  });

  it('fails closed when the policy cannot parse the command', async () => {
    await assert.rejects(
      hooks['tool.execute.before']({ tool: 'bash', sessionID: SESSION }, { args: { command: 'echo $(ls' } }),
      /policy enforcer internal error/
    );
  });

  it('ignores tools it does not manage', async () => {
    const output = { args: { command: 'rm -rf /' } };
    await hooks['tool.execute.before']({ tool: 'read', sessionID: SESSION }, output);
    assert.equal(output.args.command, 'rm -rf /');
  });

  it('appends active-session context to task prompts', async () => {
    const stateDir = path.join(workspace, 'docs', 'maestro', 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'active-session.md'),
      '---\nsession_id: s1\ncurrent_phase: 2\nstatus: in_progress\n---\n'
    );
    const output = { args: { subagent_type: 'coder', prompt: 'Implement it' } };

    await hooks['tool.execute.before']({ tool: 'task', sessionID: SESSION }, output);

    assert.match(output.args.prompt, /^Implement it\n\n\[Maestro\] Active session: current_phase=2, status=in_progress$/);
  });

  it('leaves the task prompt alone when there is no active session', async () => {
    const output = { args: { subagent_type: 'coder', prompt: 'Implement it' } };
    await hooks['tool.execute.before']({ tool: 'task', sessionID: SESSION }, output);
    assert.equal(output.args.prompt, 'Implement it');
  });

  it('requests one retry when the handoff report is malformed, then allows', async () => {
    await hooks['tool.execute.before'](
      { tool: 'task', sessionID: SESSION },
      { args: { subagent_type: 'coder', prompt: 'delegate to coder' } }
    );

    const first = { title: 't', output: 'done without report', metadata: {} };
    await hooks['tool.execute.after']({ tool: 'task', sessionID: SESSION, args: {} }, first);
    assert.match(first.output, /\[Maestro handoff validation\] Handoff report validation failed/);

    await hooks['tool.execute.before'](
      { tool: 'task', sessionID: SESSION },
      { args: { subagent_type: 'coder', prompt: 'delegate to coder' } }
    );
    const second = { title: 't', output: 'still no report', metadata: {} };
    await hooks['tool.execute.after']({ tool: 'task', sessionID: SESSION, args: {} }, second);
    assert.equal(second.output, 'still no report');
  });

  it('accepts a well-formed handoff report', async () => {
    await hooks['tool.execute.before'](
      { tool: 'task', sessionID: SESSION },
      { args: { subagent_type: 'coder', prompt: 'delegate to coder' } }
    );
    const report = '## Task Report\nok\n\n## Downstream Context\nnone';
    const output = { title: 't', output: report, metadata: {} };
    await hooks['tool.execute.after']({ tool: 'task', sessionID: SESSION, args: {} }, output);
    assert.equal(output.output, report);
  });

  it('does not validate non-task tool results', async () => {
    const output = { title: 't', output: 'plain', metadata: {} };
    await hooks['tool.execute.after']({ tool: 'bash', sessionID: SESSION, args: {} }, output);
    assert.equal(output.output, 'plain');
  });

  it('tolerates session events with missing or malformed payloads', async () => {
    await hooks.event({ event: { type: 'session.created', properties: {} } });
    await hooks.event({ event: { type: 'session.created', properties: { info: { id: 'bad id!' } } } });
    await hooks.event({ event: { type: 'session.deleted', properties: { info: { id: SESSION } } } });
    await hooks.event({ event: { type: 'message.updated', properties: { info: { id: SESSION } } } });
  });
});
