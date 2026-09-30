'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../opencode/install-opencode.sh');

function run(args, cwd) {
  return spawnSync('sh', [SCRIPT, ...args], { encoding: 'utf8', cwd });
}

describe('opencode/install-opencode.sh', () => {
  it('is executable', () => {
    fs.accessSync(SCRIPT, fs.constants.X_OK);
  });

  it('forwards --help to the node installer', () => {
    const result = run(['--help'], os.tmpdir());
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Install Maestro into opencode/);
  });

  it('installs and uninstalls into an explicit config dir', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-oc-inst-'));
    try {
      const install = run(['--config-dir', dir], os.tmpdir());
      assert.equal(install.status, 0, install.stderr);
      assert.ok(fs.existsSync(path.join(dir, 'maestro', 'install-manifest.json')));
      const uninstall = run(['--uninstall', '--config-dir', dir], os.tmpdir());
      assert.equal(uninstall.status, 0, uninstall.stderr);
      assert.ok(!fs.existsSync(path.join(dir, 'maestro', 'install-manifest.json')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
