'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const parseFrontmatter = require('../../src/transforms/parse-frontmatter');
const extractExamples = require('../../src/transforms/extract-examples');
const rebuildFrontmatter = require('../../src/transforms/rebuild-frontmatter');
const agentStub = require('../../src/transforms/agent-stub');
const skillDiscoveryStub = require('../../src/transforms/skill-discovery-stub');
const opencode = require('../../src/platforms/opencode/runtime-config');

function buildAgent(capabilities) {
  return [
    '---',
    'name: code-reviewer',
    'description: "Code review specialist."',
    'color: blue',
    'tools: [read_file, glob]',
    'max_turns: 15',
    'temperature: 0.2',
    'timeout_mins: 5',
    `capabilities: ${capabilities}`,
    '---',
    '',
    '## Methodology',
    'Review code carefully.',
  ].join('\n');
}

function runAgentPipeline(content) {
  const options = { state: {} };
  let result = parseFrontmatter(content, opencode, options);
  result = extractExamples(result, opencode, options);
  result = rebuildFrontmatter(result, opencode, options);
  return agentStub(result, opencode, options);
}

describe('opencode agent frontmatter', () => {
  it('emits description, mode, temperature and steps without name, color or tools', () => {
    const out = runAgentPipeline(buildAgent('full'));

    assert.match(out, /^---\ndescription: "Code review specialist\."\nmode: subagent\ntemperature: 0\.2\nsteps: 15\n---\n/);
    assert.equal(/^name:/m.test(out), false);
    assert.equal(/^color:/m.test(out), false);
    assert.equal(/^tools:/m.test(out), false);
    assert.equal(/^timeout/m.test(out), false);
  });

  it('adds no permission block for full-capability agents', () => {
    assert.equal(/^permission:/m.test(runAgentPipeline(buildAgent('full'))), false);
  });

  it('derives permissions from capabilities', () => {
    assert.match(runAgentPipeline(buildAgent('read_only')), /permission:\n {2}edit: deny\n {2}bash: deny\n/);
    assert.match(runAgentPipeline(buildAgent('read_shell')), /permission:\n {2}edit: deny\n {2}bash: allow\n/);
    assert.match(runAgentPipeline(buildAgent('read_write')), /permission:\n {2}edit: allow\n {2}bash: deny\n/);
  });

  it('keeps the canonical agent name in the get_agent stub despite the omitted name field', () => {
    const out = runAgentPipeline(buildAgent('full'));

    assert.match(out, /`maestro_get_agent\(agents: \["code-reviewer"\]\)`/);
  });
});

describe('opencode skill discovery stub', () => {
  it('points at the prefixed MCP tool', () => {
    const source = '---\nname: delegation\ndescription: Delegate well\n---\nBody\n';
    const out = skillDiscoveryStub(source, opencode);

    assert.match(out, /maestro_get_skill_content\(resources: \["delegation"\]\)/);
    assert.equal(out.includes('user-invocable'), false);
  });
});
