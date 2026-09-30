# CONTEXT

Shared context for all coding agents. Keep concise and current; no secrets.

## Project
Maestro (`@josstei/maestro`): multi-agent orchestration platform (39 specialists, Express + 4-phase Standard workflows, persistent session state). One canonical `src/` tree generates five runtime targets: Gemini CLI (repo root), Claude Code (`claude/`), Codex (`plugins/maestro/`), Qwen Code (`qwen/`), opencode (`opencode/`). Fork of `josstei/maestro-orchestrate`.

## Architecture
- `src/` is the only hand-authored source (plus hand-written runtime glue: `claude/scripts|hooks|mcp`, `opencode/plugins`, `hooks/`, `mcp/`, `policies/`, `bin/`).
- `scripts/generate.js` + `src/manifest.js` + `src/transforms/*` + `src/entry-points/*` + `src/platforms/*/{runtime-config,metadata}.js` emit committed runtime files. CI checks zero drift.
- 17-tool stdio MCP server in `src/mcp/`; agent and skill content is served over MCP. Hook logic in `src/hooks/logic/` is runtime-agnostic.
- Detached runtime payloads are generated at `claude/src`, `plugins/maestro/src`, `opencode/src`.

## opencode runtime
- Layout: `opencode/{agents,commands,skills,src,opencode.template.json}` generated; `opencode/plugins/maestro.js` (thin ESM) hand-written; `opencode/plugins/package.json` (`type: module`) exists so Node can import it in tests.
- Install: `scripts/install-opencode-plugin.js` (bin `maestro-install-opencode`; not in the published 1.6.4 package). `opencode/install-opencode.sh` is a hand-written sh wrapper that runs it from a checkout (flags pass through; covered by `tests/unit/opencode-install-script.test.js`). Copies into `~/.config/opencode` (`--global`, honors `OPENCODE_CONFIG_DIR`/`XDG_CONFIG_HOME`) or `./.opencode` (`--project`), payload under `<config>/maestro/`, merges `mcp.maestro` into `<config>/opencode.json`, tracks files in `<config>/maestro/install-manifest.json`. Skips files it did not install unless `--force`; `--uninstall` removes only tracked files.
- opencode facts verified against 1.18.32: plural dirs `agents/ commands/ skills/ plugins/` (singular also works); local plugins must be ESM with a named function export (CJS export objects fail with "Plugin export is not a function"); `opencode.json` and `opencode.jsonc` are both loaded and merged (installer never rewrites `.jsonc`); MCP tools are named `maestro_<tool>`; MCP cwd is the project directory; `shell.env`, `tool.execute.before/after` (`task`, `bash`) and `event` hooks work.
- Hooks: `src/hooks/opencode-plugin.js` runs the shared logic in-process (sets `MAESTRO_QUIET=1`, honored by `src/core/logger.js`). Bash deny rules come from `src/core/command-policy.js` (extracted from the Claude enforcer, now shared). Ask rules (redirect/tee) cannot be enforced on opencode (no confirmation hook).
- Feature flag `opencodeStateContract` selects the state-script text in `src/references/architecture.md` (scripts via `$MAESTRO_EXTENSION_PATH`, exported by the plugin).
- Agents install unprefixed (e.g. `coder`); name collisions are skipped by the installer.
- Decision: agent `permission` (edit/bash) derives from each agent's `capabilities`.

## Build / test / run
- `npm run check` runs every gate. `node scripts/generate.js` (regenerate; run after any `src/` change), `node --test tests/unit/*.test.js tests/transforms/*.test.js tests/integration/*.test.js`, `node scripts/check-layer-boundaries.js`, `npm run pack:verify`, `npm run release:artifacts`, `npm run release:verify-artifacts`. `just ci` wraps generate/drift/layers/tests.
- Manual opencode check: install into a scratch dir (`--config-dir` or `--project`), `opencode mcp list`, then `opencode run -m <model> "..."` to exercise MCP tools and the plugin (a denied `rm -rf` must be blocked).
- Branches must be semantic (`feat/...`); commits `type(scope): subject`; no agent attribution in commits/PRs (global rule).

## Gate status
Entry point: `npm run check` (or `just gates`) runs lint, quality, sast, sca, coverage, regression, smoke. Pre-commit runs lint when dev dependencies are installed; CI (GitHub Actions, `generator-check.yml`) runs every gate.

| Gate | Tool | Command | Status | Evidence |
|------|------|---------|--------|----------|
| unit tests | node:test | `npm test` | pass | 1192 pass, 0 fail (2026-09-30) |
| coverage >= 80% | c8 (threshold enforced in package.json) | `npm run coverage` | pass | 89.73% lines/statements, 85.92% branches, 93.55% functions; c8 exits 1 below threshold (verified) |
| sast | eslint-plugin-security | `npm run sast` | pass | 0 findings, 0 warnings; 4 noisy rules disabled with justification in `eslint.sast.config.js` |
| sca | npm audit | `npm run sca` | pass | 0 vulnerabilities (`npm audit fix` applied to a transitive dev dependency) |
| lint | eslint | `npm run lint` | pass | 0 errors, 0 warnings |
| quality: complexity, layers | eslint complexity + check-layer-boundaries | `npm run quality` | pass | complexity ceiling 36 (current max; ratchet down), layer check clean |
| quality: formatter, types | none | - | blocked | plain JS repo with no formatter or type checker; adopting prettier would reformat every file, needs a decision |
| regression | node:test integration suite | `npm run regression` | pass | 116 pass; new behavior has reproducing tests |
| smoke | scripts/smoke.js | `npm run smoke` | pass | installs opencode bundle, drives installed MCP server: 17 tools, runtime=opencode |
| drift | generator | `node scripts/generate.js` + zero-diff test | pass | zero drift |
| release artifacts | npm scripts | `pack:verify`, `release:artifacts`, `release:verify-artifacts` | pass | verified 2026-09-30 |

## Known issues / next steps
- Decide on a formatter and type checking (currently the only unmet gate rows).
- Ratchet the complexity ceiling (36) down; hot spots: `assertRuntimeManifestShape`, `session-state-tools.js`, `plan-schema validatePhases`, `protocol-dispatcher respond`.
- `.gitignore` lists tracked `src/manifest.js` (no effect on tracked files, misleading).
- Ask rules are advisory on opencode; agents install unprefixed.
- The Task-tool hook path (`before`/`after`) is unit-tested but not exercised end to end (the free opencode model tier rejects subagent calls).
- CHANGELOG is not updated by hand; the release workflow owns it.
