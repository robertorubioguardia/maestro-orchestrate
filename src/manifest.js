module.exports = [
  // ── Agent discovery stubs — Gemini, Claude, Qwen, and opencode ─────
  { glob: 'agents/*.md',
    transforms: ['parse-frontmatter', 'extract-examples', 'rebuild-frontmatter', 'agent-stub'],
    runtimes: ['gemini', 'claude', 'qwen', 'opencode'] },

  // ── Shared skill discovery stubs — Claude, Codex, and opencode ─────
  { glob: 'skills/shared/**/SKILL.md',
    transforms: ['skill-discovery-stub'],
    runtimes: ['claude', 'codex', 'opencode'] },
];
