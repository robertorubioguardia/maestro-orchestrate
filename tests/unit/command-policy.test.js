'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { checkCommand, splitCommands } = require('../../src/core/command-policy');

describe('command-policy', () => {
  it('approves ordinary commands', () => {
    assert.deepEqual(checkCommand('ls -la && git status'), { decision: 'approve' });
  });

  it('blocks recursive force delete, including inside chained commands', () => {
    assert.equal(checkCommand('rm -rf /tmp/x').decision, 'block');
    assert.equal(checkCommand('echo ok && rm -fr build').decision, 'block');
    assert.equal(checkCommand('sudo rm -rf /').decision, 'block');
  });

  it('blocks destructive git commands', () => {
    assert.equal(checkCommand('git reset --hard HEAD~1').decision, 'block');
    assert.equal(checkCommand('git clean -xfd').decision, 'block');
    assert.equal(checkCommand('git checkout -- file.txt').decision, 'block');
  });

  it('blocks heredocs', () => {
    assert.equal(checkCommand('cat <<EOF\nx\nEOF').decision, 'block');
  });

  it('inspects $(...) and backtick subshells', () => {
    assert.equal(checkCommand('echo $(rm -rf /tmp/x)').decision, 'block');
    assert.equal(checkCommand('echo `rm -rf /tmp/x`').decision, 'block');
  });

  it('does not treat quoted text as a command', () => {
    assert.equal(checkCommand("echo 'a; rm -rf b'").decision, 'approve');
  });

  it('asks for tee and redirection', () => {
    assert.equal(checkCommand('echo hi | tee out.txt').decision, 'ask');
    assert.equal(checkCommand('echo hi > out.txt').decision, 'ask');
  });

  it('prefers block over ask when both match', () => {
    assert.equal(checkCommand('echo hi > out.txt; rm -rf x').decision, 'block');
  });

  it('throws on an unterminated command substitution', () => {
    assert.throws(() => checkCommand('echo $(ls'), /Unterminated/);
  });

  it('splits on ;, &&, || and |', () => {
    assert.deepEqual(splitCommands('a; b && c || d | e'), ['a', 'b', 'c', 'd', 'e']);
  });
});
