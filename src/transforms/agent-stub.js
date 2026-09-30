const { extractValue, splitAtBoundary } = require('../lib/frontmatter');
const { toKebabCase } = require('../lib/naming');

function canonicalAgentName(name, runtime) {
  if (!name) return name;
  if (runtime.agentNaming === 'snake_case') {
    return toKebabCase(name);
  }
  return name;
}

function replaceBodyWithStub(content, stubBody) {
  const { raw } = splitAtBoundary(content);
  if (raw) {
    return '---\n' + raw + '\n---\n\n' + stubBody;
  }
  return stubBody;
}

function agentStub(content, runtime, options = {}) {
  // Runtimes whose frontmatter omits `name` (opencode names agents by filename)
  // still need the canonical name for the get_agent hint.
  const stateName = options.state && options.state.frontmatter && options.state.frontmatter.name;
  const name = canonicalAgentName(extractValue(content, 'name') || stateName || '', runtime);
  const tool = runtime.name === 'opencode' ? 'maestro_get_agent' : 'get_agent';
  const stubBody =
    `Agent methodology loaded via MCP tool \`${tool}\`. ` +
    `Call \`${tool}(agents: ["${name}"])\` to read the full methodology at delegation time.\n`;

  return replaceBodyWithStub(content, stubBody);
}

module.exports = agentStub;
