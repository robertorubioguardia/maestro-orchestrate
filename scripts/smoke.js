#!/usr/bin/env node
'use strict';

/**
 * Smoke test: install the opencode bundle into a scratch directory, start the
 * installed MCP server over stdio, and exercise the critical path
 * (initialize -> tools/list -> get_runtime_context).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { install } = require('./install-opencode-plugin');

const EXPECTED_TOOL_COUNT = 17;
const TIMEOUT_MS = 15000;

function rpcClient(child) {
  let buffer = '';
  let nextId = 1;
  const pending = new Map();

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }
  });

  return {
    request(method, params) {
      const id = nextId++;
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      return new Promise((resolve) => pending.set(id, resolve));
    },
    notify(method, params) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`smoke: ${message}`);
}

async function main() {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-smoke-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-smoke-ws-'));
  let child;
  const timer = setTimeout(() => {
    console.error('smoke: timed out');
    if (child) child.kill('SIGKILL');
    process.exit(1);
  }, TIMEOUT_MS);

  try {
    install({ configDir, version: 'smoke' });
    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'opencode.json'), 'utf8'));
    const entry = config.mcp.maestro;
    assert(entry && entry.type === 'local', 'installer did not write mcp.maestro');

    child = spawn(entry.command[0], entry.command.slice(1), {
      cwd: workspace,
      env: { ...process.env, ...entry.environment },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const rpc = rpcClient(child);

    const init = await rpc.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'maestro-smoke', version: '0' },
    });
    assert(init.result && init.result.serverInfo.name === 'maestro', 'initialize failed');
    rpc.notify('notifications/initialized', {});

    const listed = await rpc.request('tools/list', {});
    const tools = listed.result.tools.map((tool) => tool.name);
    assert(tools.length === EXPECTED_TOOL_COUNT, `expected ${EXPECTED_TOOL_COUNT} tools, got ${tools.length}`);
    for (const name of ['create_session', 'get_agent', 'get_runtime_context']) {
      assert(tools.includes(name), `missing tool ${name}`);
    }

    const called = await rpc.request('tools/call', { name: 'get_runtime_context', arguments: {} });
    assert(!called.result.isError, 'get_runtime_context returned an error');
    const context = JSON.parse(called.result.content[0].text);
    assert(context.runtime === 'opencode', `runtime should be opencode, got ${context.runtime}`);
    assert(context.mcp_prefix === 'maestro_', 'unexpected mcp_prefix');

    console.log(`smoke: ok (${tools.length} tools, runtime=${context.runtime})`);
  } finally {
    clearTimeout(timer);
    if (child) child.kill('SIGTERM');
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error.message);
    process.exit(1);
  }
);
