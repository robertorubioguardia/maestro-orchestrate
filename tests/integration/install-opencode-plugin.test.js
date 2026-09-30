'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { ROOT } = require('./helpers');
const { install, uninstall, parseArgs, resolveConfigDir } = require('../../scripts/install-opencode-plugin');

const SCRIPT = path.join(ROOT, 'scripts', 'install-opencode-plugin.js');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('install-opencode-plugin', () => {
  let configDir;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-oc-install-'));
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('installs agents, commands, skills, plugin, payload and the MCP entry', () => {
    const result = install({ configDir, version: '9.9.9' });

    assert.equal(result.skipped.length, 0);
    assert.equal(fs.readdirSync(path.join(configDir, 'agents')).length, 39);
    assert.equal(fs.readdirSync(path.join(configDir, 'commands')).length, 12);
    assert.equal(fs.readdirSync(path.join(configDir, 'skills')).length, 7);
    assert.ok(fs.existsSync(path.join(configDir, 'plugins', 'maestro.js')));
    assert.ok(fs.existsSync(path.join(configDir, 'maestro', 'src', 'mcp', 'maestro-server.js')));
    assert.ok(fs.existsSync(path.join(configDir, 'maestro', 'src', 'hooks', 'opencode-plugin.js')));

    const config = readJson(path.join(configDir, 'opencode.json'));
    const installDir = path.join(configDir, 'maestro');
    assert.deepEqual(config.mcp.maestro.command, ['node', path.join(installDir, 'src', 'mcp', 'maestro-server.js')]);
    assert.equal(config.mcp.maestro.environment.MAESTRO_RUNTIME, 'opencode');
    assert.equal(config.mcp.maestro.environment.MAESTRO_EXTENSION_PATH, installDir);
    assert.equal(JSON.stringify(config).includes('__MAESTRO_INSTALL_DIR__'), false);

    const manifest = readJson(path.join(installDir, 'install-manifest.json'));
    assert.equal(manifest.version, '9.9.9');
    assert.equal(manifest.createdConfigFile, true);
    assert.ok(manifest.files.includes(path.join('agents', 'coder.md')));
  });

  it('writes nothing on a dry run', () => {
    const result = install({ configDir, dryRun: true });

    assert.ok(result.installed.length > 100);
    assert.deepEqual(fs.readdirSync(configDir), []);
  });

  it('merges into an existing opencode.json without touching other keys', () => {
    fs.writeFileSync(
      path.join(configDir, 'opencode.json'),
      JSON.stringify({ theme: 'dark', mcp: { other: { type: 'remote', url: 'https://example.com' } } })
    );

    install({ configDir });

    const config = readJson(path.join(configDir, 'opencode.json'));
    assert.equal(config.theme, 'dark');
    assert.equal(config.mcp.other.url, 'https://example.com');
    assert.ok(config.mcp.maestro);
    assert.equal(readJson(path.join(configDir, 'maestro', 'install-manifest.json')).createdConfigFile, false);
  });

  it('leaves an existing opencode.jsonc untouched', () => {
    const jsonc = '{\n  // keep me\n  "theme": "dark"\n}\n';
    fs.writeFileSync(path.join(configDir, 'opencode.jsonc'), jsonc);

    install({ configDir });

    assert.equal(fs.readFileSync(path.join(configDir, 'opencode.jsonc'), 'utf8'), jsonc);
    assert.ok(readJson(path.join(configDir, 'opencode.json')).mcp.maestro);
  });

  it('refuses to merge into an opencode.json that is not strict JSON', () => {
    fs.writeFileSync(path.join(configDir, 'opencode.json'), '{ // comment\n}');

    assert.throws(() => install({ configDir }), /not strict JSON/);
    assert.equal(fs.existsSync(path.join(configDir, 'maestro')), false);
  });

  it('skips existing files it did not install unless forced', () => {
    fs.mkdirSync(path.join(configDir, 'agents'), { recursive: true });
    const mine = path.join(configDir, 'agents', 'coder.md');
    fs.writeFileSync(mine, 'my own coder agent');

    const skippedRun = install({ configDir });
    assert.deepEqual(skippedRun.skipped, [path.join('agents', 'coder.md')]);
    assert.equal(fs.readFileSync(mine, 'utf8'), 'my own coder agent');

    const forcedRun = install({ configDir, force: true });
    assert.equal(forcedRun.skipped.length, 0);
    assert.notEqual(fs.readFileSync(mine, 'utf8'), 'my own coder agent');
  });

  it('is idempotent and removes files that are no longer shipped', () => {
    install({ configDir });
    const manifestFile = path.join(configDir, 'maestro', 'install-manifest.json');
    const manifest = readJson(manifestFile);
    const ghost = path.join('agents', 'retired-agent.md');
    fs.writeFileSync(path.join(configDir, ghost), 'old');
    manifest.files.push(ghost);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));

    const result = install({ configDir });

    assert.deepEqual(result.removedStale, [ghost]);
    assert.equal(fs.existsSync(path.join(configDir, ghost)), false);
    assert.equal(result.mcpAction, 'updated');
  });

  it('uninstalls exactly what it installed and keeps user files and config', () => {
    fs.writeFileSync(path.join(configDir, 'opencode.json'), JSON.stringify({ theme: 'dark' }));
    fs.mkdirSync(path.join(configDir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(configDir, 'agents', 'mine.md'), 'mine');
    install({ configDir });

    const result = uninstall({ configDir });

    assert.equal(result.mcpRemoved, true);
    assert.equal(fs.existsSync(path.join(configDir, 'maestro')), false);
    assert.equal(fs.existsSync(path.join(configDir, 'plugins')), false);
    assert.deepEqual(fs.readdirSync(path.join(configDir, 'agents')), ['mine.md']);
    assert.deepEqual(readJson(path.join(configDir, 'opencode.json')), { theme: 'dark' });
  });

  it('deletes the opencode.json it created when uninstalling', () => {
    install({ configDir });
    uninstall({ configDir });

    assert.deepEqual(fs.readdirSync(configDir), []);
  });

  it('reports nothing to do when Maestro is not installed', () => {
    const result = uninstall({ configDir });

    assert.equal(result.notInstalled, true);
  });

  it('fails clearly when the generated payload is missing', () => {
    assert.throws(
      () => install({ sourceDir: path.join(configDir, 'nowhere'), configDir }),
      /payload not found/
    );
  });

  it('resolves config directories for global, project and explicit scopes', () => {
    assert.equal(resolveConfigDir({ scope: 'global' }, { OPENCODE_CONFIG_DIR: '/x/oc' }), '/x/oc');
    assert.equal(resolveConfigDir({ scope: 'global' }, { XDG_CONFIG_HOME: '/x/cfg' }), path.join('/x/cfg', 'opencode'));
    assert.equal(resolveConfigDir({ scope: 'project' }, {}, '/work/app'), path.join('/work/app', '.opencode'));
    assert.equal(resolveConfigDir({ scope: 'project', configDir: '/y/dir' }, {}, '/work/app'), '/y/dir');
  });

  it('parses flags and rejects unknown ones', () => {
    assert.deepEqual(parseArgs(['--project', '--dry-run', '--force']), {
      scope: 'project',
      configDir: null,
      uninstall: false,
      force: true,
      dryRun: true,
    });
    assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
    assert.throws(() => parseArgs(['--config-dir']), /requires a directory/);
  });

  it('runs end to end through the CLI', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--config-dir', configDir], { encoding: 'utf8' });

    assert.match(out, /Maestro installed for opencode/);
    assert.ok(readJson(path.join(configDir, 'opencode.json')).mcp.maestro);

    const removed = execFileSync(process.execPath, [SCRIPT, '--config-dir', configDir, '--uninstall'], { encoding: 'utf8' });
    assert.match(removed, /Maestro removed from opencode/);
  });
});
