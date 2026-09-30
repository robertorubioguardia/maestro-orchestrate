# opencode Runtime

The opencode integration lives in the `opencode/` subdirectory and is installed into an opencode config directory by `scripts/install-opencode-plugin.js`.

## Configuration

**Manifest**: none (opencode has no plugin manifest or marketplace); `opencode/opencode.json` is the MCP entry template
**Version**: generated from `package.json`
**Plugin**: `opencode/plugins/maestro.js`
**MCP Config**: `opencode/opencode.json`

### Install

```bash
# Global install into ~/.config/opencode (or $OPENCODE_CONFIG_DIR)
npx -y -p @josstei/maestro maestro-install-opencode

# From a clone (shell wrapper around the Node installer; same flags)
./opencode/install-opencode.sh [--global | --project | --config-dir <dir>] [--dry-run] [--force] [--uninstall]

# Equivalent
node scripts/install-opencode-plugin.js [--global | --project | --config-dir <dir>] [--dry-run] [--force] [--uninstall]
```

Do not run `opencode` from inside the repo's `opencode/` directory: it would load the raw `opencode.json` template as a project config, whose `__MAESTRO_INSTALL_DIR__` placeholder is only substituted in the installed copy, and `opencode mcp list` would report `maestro` as failed.

The installer:

- copies `agents/`, `commands/`, `skills/<name>/SKILL.md` and `plugins/maestro.js` into the config directory (`~/.config/opencode/` for `--global`, `./.opencode/` for `--project`);
- copies the runtime payload to `<config>/maestro/src/` and records every installed file in `<config>/maestro/install-manifest.json`;
- merges `mcp.maestro` into `<config>/opencode.json` without touching other keys (opencode merges `opencode.json` and `opencode.jsonc`, so an existing `opencode.jsonc` keeps its comments and is never rewritten);
- skips existing files it did not install (rerun with `--force` to overwrite) and never deletes anything it did not create;
- `--uninstall` removes exactly the files in the manifest and the `mcp.maestro` entry.

### MCP Server

```json
{
  "mcp": {
    "maestro": {
      "type": "local",
      "command": ["node", "<config>/maestro/src/mcp/maestro-server.js"],
      "environment": {
        "MAESTRO_RUNTIME": "opencode",
        "MAESTRO_EXTENSION_PATH": "<config>/maestro"
      },
      "enabled": true
    }
  }
}
```

The server runs from the installed payload, so no network or `npx` is needed at start-up. opencode starts local MCP servers in the project directory, so the workspace root resolves from the working directory. opencode exposes MCP tools as `<server>_<tool>` (for example `maestro_create_session`). opencode declares `primary: filesystem` and `fallback: none`.

## Agent Naming

opencode uses **kebab-case** for agent names: `code-reviewer`, `api-designer`, `accessibility-specialist`. The file name is the agent name.

Agent files are generated at `opencode/agents/*.md` with kebab-case filenames. They install unprefixed, so an existing agent with the same name is skipped by the installer.

## Delegation

opencode `task` tool with a subagent:

```
task(subagent_type: "coder", prompt: "...")
task(subagent_type: "architect", prompt: "...")
```

## Commands and Skills

12 Markdown commands in `opencode/commands/` (invoked as `/<name>`):

**Core (3)**: `orchestrate`, `execute`, `resume-session`

**Entry-point (9)**: `review-code`, `debug-workflow`, `archive`, `status`, `security-audit`, `perf-check`, `seo-audit`, `a11y-audit`, `compliance-check`. `review`, `debug` and `resume` are remapped (see `src/generator/entry-point-expander.js` `HOST_RESERVED_NAMES`) to keep the command surface aligned with Claude Code and Codex.

7 discovery stubs in `opencode/skills/` (`code-review`, `delegation`, `design-dialogue`, `execution`, `implementation-planning`, `session-management`, `validation`) that delegate to `maestro_get_skill_content`.

## Hooks

opencode has no JSON hook registry; hooks are an in-process JavaScript plugin. `opencode/plugins/maestro.js` is a thin ESM entry that loads `src/hooks/opencode-plugin.js`, which reuses the shared logic in `src/hooks/logic/`.

| opencode hook | Maestro behavior |
|---------------|------------------|
| `event` `session.created` / `session.deleted` | session-start / session-end hook state |
| `tool.execute.before` (`task`) | before-agent: records the active agent, appends active-session context to the subagent prompt |
| `tool.execute.after` (`task`) | after-agent: validates the `## Task Report` and `## Downstream Context` sections; on failure appends a retry instruction to the task result (one retry, then allows) |
| `tool.execute.before` (`bash`) | policy: throws on DENY rules |
| `shell.env` | exports `MAESTRO_EXTENSION_PATH` and `MAESTRO_RUNTIME` to every shell command |

The plugin sets `MAESTRO_QUIET=1` so hook logging never writes into the opencode UI.

## Policy Enforcement

`src/core/command-policy.js` (shared with the Claude enforcer) evaluates `src/core/policy-rules.js`:

**Deny rules** (throws, command does not run): `rm -rf` variants, `git reset --hard`, `git checkout --`, `git clean -fd` variants, heredocs (`<<`).

**Ask rules** (`tee`, output redirection) are **not enforced** on opencode: it has no per-call confirmation hook. Use opencode's own `permission.bash` settings if you want prompts for those.

## Tool Mapping

| Canonical | opencode |
|-----------|----------|
| `read_file` / `read_many_files` | `read` |
| `write_file` | `write` |
| `replace` | `edit` |
| `list_directory` | `list` |
| `glob` | `glob` |
| `grep_search` | `grep` |
| `google_web_search` | `websearch` |
| `web_fetch` | `webfetch` |
| `run_shell_command` | `bash` |
| `ask_user` | `question` |
| `write_todos` | `todowrite` |
| `activate_skill` | `skill` |
| `enter_plan_mode` / `exit_plan_mode` | not native; present in conversation and approve with `question` |
| `codebase_investigator` | `task (explore)` / `grep` / `glob` |

## Feature Flags

The canonical feature set (same 5 flags across all runtimes, values per runtime):

```
exampleBlocks:             false
claudeStateContract:       false
scriptBasedStateContract:  false
codexStateContract:        false
opencodeStateContract:     true   (state scripts via $MAESTRO_EXTENSION_PATH)
```

See `src/platforms/opencode/runtime-config.js` for the authoritative values.

## Agent Frontmatter

opencode agent stubs use `mode: subagent`, `steps`, and a `permission` block derived from the agent's `capabilities`:

| capabilities | edit | bash |
|--------------|------|------|
| `full` | (default) | (default) |
| `read_only` | deny | deny |
| `read_shell` | deny | allow |
| `read_write` | allow | deny |

```yaml
---
description: "Implementation specialist..."
mode: subagent
temperature: 0.2
steps: 25
---
```

## Generated Files

```
opencode/
├── agents/                39 agent stubs (kebab-case)
├── commands/              12 command files
├── skills/                7 skill discovery stubs
├── plugins/               hand-written plugin entry (maestro.js)
├── src/                   generated runtime payload (MCP server, hook logic)
└── opencode.json          MCP entry template (install dir token replaced by the installer)
```
