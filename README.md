# Maestro

[![Version](https://img.shields.io/badge/version-1.6.4-blue)](https://github.com/josstei/maestro-orchestrate/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Gemini CLI](https://img.shields.io/badge/Gemini_CLI-extension-orange)](https://github.com/google-gemini/gemini-cli)
[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-blue)](https://docs.anthropic.com/en/docs/claude-code)
[![Codex](https://img.shields.io/badge/Codex-plugin-black)](docs/runtime-codex.md)
[![Qwen Code](https://img.shields.io/badge/Qwen_Code-extension-purple)](https://github.com/QwenLM/qwen-code)
[![opencode](https://img.shields.io/badge/opencode-plugin-teal)](docs/runtime-opencode.md)

Maestro is a multi-agent development orchestration platform with 39 specialists, an Express path for simple work, a 4-phase standard workflow for medium and complex work, persistent session state, and standalone review/debug/security/perf/seo/accessibility/compliance entrypoints. It runs from one canonical `src/` tree across **Gemini CLI**, **Claude Code**, **Codex**, **Qwen Code**, and **opencode**.

## Runtime Targets

| Runtime | Location | Public Surface | Notes |
|---------|----------|----------------|-------|
| Gemini CLI | repo root | `/maestro:*` | Snake-case agents, TOML commands, hooks, TOML shell policies |
| Claude Code | `claude/` | `/orchestrate`, `/review-code`, ... | Kebab-case agents with `maestro:` subagent names |
| Codex | `plugins/maestro/` | `$maestro:*` | Plugin skills, `spawn_agent`, no runtime hooks |
| Qwen Code | `qwen/` | `/maestro:*` | Gemini-CLI-compatible extension, `QWEN.md` context file, `SubagentStart`/`SubagentStop` hooks |
| opencode | `opencode/` | `/orchestrate`, `/review-code`, ... | Kebab-case agents, markdown commands, in-process JS plugin for hooks, installed with `maestro-install-opencode` |

## Getting Started

### Prerequisites

- One supported runtime: Gemini CLI, Claude Code, Codex, Qwen Code, or opencode
- Node.js 20+ for the MCP server and helper scripts
- Gemini CLI and Qwen Code only: enable experimental subagents in `~/.gemini/settings.json` (Gemini) or `~/.qwen/settings.json` (Qwen)

```json
{
  "experimental": {
    "enableAgents": true
  }
}
```

Maestro does not edit `~/.gemini/settings.json` or `~/.qwen/settings.json` for you.

### Installation

#### Gemini CLI

```bash
gemini extensions install https://github.com/josstei/maestro-orchestrate
```

Local development:

```bash
git clone https://github.com/josstei/maestro-orchestrate
cd maestro-orchestrate
gemini extensions link .
```

Verify with `gemini extensions list`.

#### Claude Code

Marketplace install:

```bash
claude plugin marketplace add josstei/maestro-orchestrate
claude plugin install maestro@maestro-orchestrator --scope user
```

Development / temporary loading:

```bash
git clone https://github.com/josstei/maestro-orchestrate
claude --plugin-dir /path/to/maestro-orchestrate/claude
```

More Claude-specific setup and plugin management lives in [claude/README.md](claude/README.md).

#### Codex

Register the marketplace:

```bash
codex plugin marketplace add josstei/maestro-orchestrate
```

Then start Codex, run `/plugins` to browse, select **Maestro**, and choose **Install**.

Local development (path must start with `./`, `../`, `/`, or `~/` — Codex otherwise treats bare `owner/repo` as a GitHub source):

```bash
git clone https://github.com/josstei/maestro-orchestrate
codex plugin marketplace add /absolute/path/to/maestro-orchestrate
# then: start Codex, run `/plugins`, select Maestro → Install
```

More Codex-specific setup and runtime details live in [plugins/maestro/README.md](plugins/maestro/README.md) and [docs/runtime-codex.md](docs/runtime-codex.md).

#### Qwen Code

```bash
qwen extensions install https://github.com/josstei/maestro-orchestrate
```

Local development:

```bash
git clone https://github.com/josstei/maestro-orchestrate
cd maestro-orchestrate
qwen extensions link .
```

Verify with `qwen extensions list`. Qwen Code uses the same `/maestro:*` command surface as Gemini CLI and reads `QWEN.md` as its context file.

#### opencode

opencode has no plugin marketplace, so Maestro ships an installer that copies the agents, commands, skills, and hook plugin into your opencode config directory and merges the `maestro` MCP server into `opencode.json` (existing settings are preserved):

```bash
# Global install into ~/.config/opencode
npx -y -p @josstei/maestro maestro-install-opencode

# Project-only install into ./.opencode
npx -y -p @josstei/maestro maestro-install-opencode --project
```

Local development:

```bash
git clone https://github.com/josstei/maestro-orchestrate
cd maestro-orchestrate
./opencode/install-opencode.sh                     # add --dry-run to preview, --uninstall to remove
# equivalent: node scripts/install-opencode-plugin.js
```

Verify with `opencode mcp list` (the `maestro` server should be connected). More details, including the hook mapping and limits, live in [docs/runtime-opencode.md](docs/runtime-opencode.md).

### Quick Start

Start a full orchestration with the runtime-specific entrypoint:

| Runtime | Example |
|---------|---------|
| Gemini CLI | `/maestro:orchestrate Build a REST API for a task management system with user authentication` |
| Claude Code | `/orchestrate Build a REST API for a task management system with user authentication` |
| Codex | `$maestro:orchestrate Build a REST API for a task management system with user authentication` |
| Qwen Code | `/maestro:orchestrate Build a REST API for a task management system with user authentication` |
| opencode | `/orchestrate Build a REST API for a task management system with user authentication` |

Maestro classifies the task, chooses Express or Standard workflow, asks the required design questions, produces an implementation plan when needed, delegates execution to specialists, runs a quality gate, and archives the session state in `docs/maestro/`.

## Examples

Usage examples: [EXAMPLES.md](EXAMPLES.md). Gemini/Qwen forms shown:

- Full orchestration: `/maestro:orchestrate Build a REST API for a task management system with user authentication`
- Standalone review: `/maestro:review Review the staged changes for correctness, regressions, security, maintainability risk, and missing tests`
- Security audit: `/maestro:security-audit Audit authentication, authorization, data exposure, secret handling, and exploitability risks`

## Configuration

Defaults work; these settings tune behavior:

| Setting | Default | Purpose |
|---------|---------|---------|
| `MAESTRO_STATE_DIR` | `docs/maestro` | Session, plan, and archive output path |
| `MAESTRO_EXECUTION_MODE` | `ask` | Choose `parallel`, `sequential`, or prompt |
| `MAESTRO_AUTO_ARCHIVE` | `true` | Archive successful sessions automatically |
| `MAESTRO_MAX_RETRIES` | `2` | Retry limit for failed phases |
| `MAESTRO_MAX_CONCURRENT` | `0` | Parallel-agent cap, where `0` means no Maestro cap |
| `MAESTRO_DISABLED_AGENTS` | unset | Specialists to exclude from assignment |

## Commands

| Capability | Gemini CLI | Claude Code | Codex | Qwen Code | opencode |
|------------|------------|-------------|-------|-----------|----------|
| Orchestrate | `/maestro:orchestrate` | `/orchestrate` | `$maestro:orchestrate` | `/maestro:orchestrate` | `/orchestrate` |
| Execute | `/maestro:execute` | `/execute` | `$maestro:execute` | `/maestro:execute` | `/execute` |
| Resume | `/maestro:resume` | `/resume-session` | `$maestro:resume-session` | `/maestro:resume` | `/resume-session` |
| Status | `/maestro:status` | `/status` | `$maestro:status` | `/maestro:status` | `/status` |
| Archive | `/maestro:archive` | `/archive` | `$maestro:archive` | `/maestro:archive` | `/archive` |
| Review | `/maestro:review` | `/review-code` | `$maestro:review-code` | `/maestro:review` | `/review-code` |
| Debug | `/maestro:debug` | `/debug-workflow` | `$maestro:debug-workflow` | `/maestro:debug` | `/debug-workflow` |
| Security Audit | `/maestro:security-audit` | `/security-audit` | `$maestro:security-audit` | `/maestro:security-audit` | `/security-audit` |
| Performance Check | `/maestro:perf-check` | `/perf-check` | `$maestro:perf-check` | `/maestro:perf-check` | `/perf-check` |
| SEO Audit | `/maestro:seo-audit` | `/seo-audit` | `$maestro:seo-audit` | `/maestro:seo-audit` | `/seo-audit` |
| Accessibility Audit | `/maestro:a11y-audit` | `/a11y-audit` | `$maestro:a11y-audit` | `/maestro:a11y-audit` | `/a11y-audit` |
| Compliance Check | `/maestro:compliance-check` | `/compliance-check` | `$maestro:compliance-check` | `/maestro:compliance-check` | `/compliance-check` |

For Claude Code, Codex, and opencode, Maestro intentionally avoids bare skill names that collide with host commands. Use `/review-code`, `/debug-workflow`, and `/resume-session` in Claude Code, and `$maestro:review-code`, `$maestro:debug-workflow`, and `$maestro:resume-session` in Codex, so built-in `/review`, `/debug`, and `/resume` commands keep working.

Qwen Code uses the same `/maestro:*` command surface as Gemini CLI. opencode uses the same command names as Claude Code (`/orchestrate`, `/review-code`, ...), installed as markdown commands.

## Workflow

- **Express**: For simple work. Maestro asks 1-2 clarifying questions, proposes a brief, delegates to one specialist, runs code review, and archives without a design doc or implementation plan.
- **Standard**: For medium and complex work. Maestro runs Design, Plan, Execute, and Complete phases with explicit approval gates, phased execution, and final review blocking on unresolved Critical or Major findings.

## Outputs and Success Criteria

Maestro writes orchestration outputs under `MAESTRO_STATE_DIR`, usually `docs/maestro/`. Standard workflow outputs include active session state, design documents, implementation plans, phase reports, validation output, and archived records.

A successful run must have an approved plan when Standard workflow is used, completed phase reports, validation results for the changed surface, and no unresolved Critical or Major review findings. If a phase cannot complete, Maestro records the blocker and the next required action instead of silently continuing.

## Security and Permissions

Maestro follows the host runtime's tool permissions, sandboxing, and confirmation model. It does not require committed secrets or long-lived credentials, and orchestration session state stays inside `MAESTRO_STATE_DIR` unless configured otherwise. Use `MAESTRO_DISABLED_AGENTS` to restrict specialists in sensitive repositories, and run `$maestro:security-audit` or the equivalent runtime command before adopting changes that touch authentication, authorization, secrets, or data exposure paths.

## Documentation

- [EXAMPLES.md](EXAMPLES.md) for copyable usage scenarios across all runtimes
- [docs/overview.md](docs/overview.md) for the project model and generated structure
- [docs/architecture.md](docs/architecture.md) for orchestration internals and architecture layout
- [docs/usage.md](docs/usage.md) for development workflow, settings, and command surfaces
- [docs/flow.md](docs/flow.md) for the orchestration workflow steps and hard gates
- [docs/cicd.md](docs/cicd.md) for CI/CD pipeline workflows, release process, and Mermaid diagrams
- [docs/runtime-gemini.md](docs/runtime-gemini.md) for Gemini runtime specifics
- [docs/runtime-claude.md](docs/runtime-claude.md) for Claude runtime specifics
- [docs/runtime-codex.md](docs/runtime-codex.md) for Codex runtime specifics
- [docs/runtime-qwen.md](docs/runtime-qwen.md) for Qwen runtime specifics
- [docs/runtime-opencode.md](docs/runtime-opencode.md) for opencode runtime specifics

## Development and Release Validation

Canonical source lives under `src/`. Runtime files in `agents/`, `commands/`, `hooks/`, `mcp/`, `policies/`, `claude/`, `plugins/maestro/`, `qwen/`, and `opencode/` are generated (except `opencode/plugins/`, which is hand-written); update `src/` first, then regenerate.

```bash
npm ci
node scripts/generate.js
git diff --exit-code --name-only
node --test tests/unit/*.test.js tests/transforms/*.test.js tests/integration/*.test.js
npm run pack:verify
npm run release:artifacts
npm run release:verify-artifacts
```

Release validation creates `dist/release/maestro-vX.Y.Z-extension.tar.gz`. The archive is intentionally generic: it unpacks with `gemini-extension.json`, `qwen-extension.json`, `.claude-plugin/marketplace.json`, and `.agents/plugins/marketplace.json` at the root, plus the runtime payload needed by Gemini CLI, Qwen Code, Claude Code, Codex, and opencode.

Stable releases publish three aligned outputs:

- Git tag `vX.Y.Z`
- npm package `@josstei/maestro@X.Y.Z`
- GitHub Release asset `maestro-vX.Y.Z-extension.tar.gz`

Codex plugin releases launch the MCP server through the matching npm package version. Hook installation is explicit via `npm run install-hooks`; package, pack, and publish flows do not install git hooks.

## License

Apache-2.0

---

# Maestro (Español)

Maestro es una plataforma de orquestación de desarrollo multiagente con 39 especialistas, una ruta Express para trabajo simple, un flujo estándar de 4 fases para trabajo medio y complejo, estado de sesión persistente y entrypoints independientes de review/debug/security/perf/seo/accesibilidad/compliance. Se ejecuta desde un único árbol canónico `src/` en **Gemini CLI**, **Claude Code**, **Codex**, **Qwen Code** y **opencode**.

## Runtimes soportados

| Runtime | Ubicación | Superficie pública | Notas |
|---------|-----------|--------------------|-------|
| Gemini CLI | raíz del repo | `/maestro:*` | Agentes en snake_case, comandos TOML, hooks, políticas de shell TOML |
| Claude Code | `claude/` | `/orchestrate`, `/review-code`, ... | Agentes en kebab-case con nombres de subagente `maestro:` |
| Codex | `plugins/maestro/` | `$maestro:*` | Skills de plugin, `spawn_agent`, sin hooks de runtime |
| Qwen Code | `qwen/` | `/maestro:*` | Extensión compatible con Gemini CLI, archivo de contexto `QWEN.md`, hooks `SubagentStart`/`SubagentStop` |
| opencode | `opencode/` | `/orchestrate`, `/review-code`, ... | Agentes en kebab-case, comandos markdown, plugin JS en proceso para los hooks, se instala con `maestro-install-opencode` |

## Primeros pasos

### Requisitos

- Un runtime soportado: Gemini CLI, Claude Code, Codex, Qwen Code u opencode
- Node.js 20+ para el servidor MCP y los scripts auxiliares
- Solo Gemini CLI y Qwen Code: habilitar los subagentes experimentales en `~/.gemini/settings.json` (Gemini) o `~/.qwen/settings.json` (Qwen)

```json
{
  "experimental": {
    "enableAgents": true
  }
}
```

Maestro no edita `~/.gemini/settings.json` ni `~/.qwen/settings.json` por ti.

### Instalación

#### Gemini CLI

```bash
gemini extensions install https://github.com/josstei/maestro-orchestrate
```

Desarrollo local:

```bash
git clone https://github.com/josstei/maestro-orchestrate
cd maestro-orchestrate
gemini extensions link .
```

Verifica con `gemini extensions list`.

#### Claude Code

Instalación desde el marketplace:

```bash
claude plugin marketplace add josstei/maestro-orchestrate
claude plugin install maestro@maestro-orchestrator --scope user
```

Desarrollo / carga temporal:

```bash
git clone https://github.com/josstei/maestro-orchestrate
claude --plugin-dir /path/to/maestro-orchestrate/claude
```

Más detalles de configuración y gestión del plugin en [claude/README.md](claude/README.md).

#### Codex

Registra el marketplace:

```bash
codex plugin marketplace add josstei/maestro-orchestrate
```

Después inicia Codex, ejecuta `/plugins` para explorar, selecciona **Maestro** y elige **Install**.

Desarrollo local (la ruta debe empezar por `./`, `../`, `/` o `~/`; de lo contrario Codex trata `owner/repo` como una fuente de GitHub):

```bash
git clone https://github.com/josstei/maestro-orchestrate
codex plugin marketplace add /absolute/path/to/maestro-orchestrate
# después: inicia Codex, ejecuta `/plugins`, selecciona Maestro → Install
```

Más detalles de Codex en [plugins/maestro/README.md](plugins/maestro/README.md) y [docs/runtime-codex.md](docs/runtime-codex.md).

#### Qwen Code

```bash
qwen extensions install https://github.com/josstei/maestro-orchestrate
```

Desarrollo local:

```bash
git clone https://github.com/josstei/maestro-orchestrate
cd maestro-orchestrate
qwen extensions link .
```

Verifica con `qwen extensions list`. Qwen Code usa la misma superficie de comandos `/maestro:*` que Gemini CLI y lee `QWEN.md` como archivo de contexto.

#### opencode

opencode no tiene marketplace de plugins, así que Maestro incluye un instalador que copia los agentes, comandos, skills y el plugin de hooks al directorio de configuración de opencode y fusiona el servidor MCP `maestro` en `opencode.json` (la configuración existente se conserva):

```bash
# Instalación global en ~/.config/opencode
npx -y -p @josstei/maestro maestro-install-opencode

# Instalación solo para el proyecto en ./.opencode
npx -y -p @josstei/maestro maestro-install-opencode --project
```

Desarrollo local:

```bash
git clone https://github.com/josstei/maestro-orchestrate
cd maestro-orchestrate
./opencode/install-opencode.sh                     # --dry-run para previsualizar, --uninstall para desinstalar
# equivalente: node scripts/install-opencode-plugin.js
```

Verifica con `opencode mcp list` (el servidor `maestro` debe aparecer conectado). Más detalles, incluidos el mapeo de hooks y sus límites, en [docs/runtime-opencode.md](docs/runtime-opencode.md).

### Inicio rápido

Inicia una orquestación completa con el entrypoint de tu runtime:

| Runtime | Ejemplo |
|---------|---------|
| Gemini CLI | `/maestro:orchestrate Build a REST API for a task management system with user authentication` |
| Claude Code | `/orchestrate Build a REST API for a task management system with user authentication` |
| Codex | `$maestro:orchestrate Build a REST API for a task management system with user authentication` |
| Qwen Code | `/maestro:orchestrate Build a REST API for a task management system with user authentication` |
| opencode | `/orchestrate Build a REST API for a task management system with user authentication` |

Maestro clasifica la tarea, elige el flujo Express o Estándar, hace las preguntas de diseño necesarias, produce un plan de implementación cuando hace falta, delega la ejecución en especialistas, ejecuta una puerta de calidad y archiva el estado de la sesión en `docs/maestro/`.

## Ejemplos

Ejemplos de uso: [EXAMPLES.md](EXAMPLES.md). Se muestran las formas de Gemini/Qwen:

- Orquestación completa: `/maestro:orchestrate Build a REST API for a task management system with user authentication`
- Revisión independiente: `/maestro:review Review the staged changes for correctness, regressions, security, maintainability risk, and missing tests`
- Auditoría de seguridad: `/maestro:security-audit Audit authentication, authorization, data exposure, secret handling, and exploitability risks`

## Configuración

Los valores por defecto funcionan; estos ajustes modifican el comportamiento:

| Ajuste | Por defecto | Propósito |
|--------|-------------|-----------|
| `MAESTRO_STATE_DIR` | `docs/maestro` | Ruta de salida de sesiones, planes y archivos |
| `MAESTRO_EXECUTION_MODE` | `ask` | Elige `parallel`, `sequential` o pregunta |
| `MAESTRO_AUTO_ARCHIVE` | `true` | Archiva automáticamente las sesiones exitosas |
| `MAESTRO_MAX_RETRIES` | `2` | Límite de reintentos para fases fallidas |
| `MAESTRO_MAX_CONCURRENT` | `0` | Límite de agentes en paralelo; `0` significa sin límite de Maestro |
| `MAESTRO_DISABLED_AGENTS` | sin definir | Especialistas a excluir de la asignación |

## Comandos

| Capacidad | Gemini CLI | Claude Code | Codex | Qwen Code | opencode |
|-----------|------------|-------------|-------|-----------|----------|
| Orquestar | `/maestro:orchestrate` | `/orchestrate` | `$maestro:orchestrate` | `/maestro:orchestrate` | `/orchestrate` |
| Ejecutar | `/maestro:execute` | `/execute` | `$maestro:execute` | `/maestro:execute` | `/execute` |
| Reanudar | `/maestro:resume` | `/resume-session` | `$maestro:resume-session` | `/maestro:resume` | `/resume-session` |
| Estado | `/maestro:status` | `/status` | `$maestro:status` | `/maestro:status` | `/status` |
| Archivar | `/maestro:archive` | `/archive` | `$maestro:archive` | `/maestro:archive` | `/archive` |
| Revisar | `/maestro:review` | `/review-code` | `$maestro:review-code` | `/maestro:review` | `/review-code` |
| Depurar | `/maestro:debug` | `/debug-workflow` | `$maestro:debug-workflow` | `/maestro:debug` | `/debug-workflow` |
| Auditoría de seguridad | `/maestro:security-audit` | `/security-audit` | `$maestro:security-audit` | `/maestro:security-audit` | `/security-audit` |
| Chequeo de rendimiento | `/maestro:perf-check` | `/perf-check` | `$maestro:perf-check` | `/maestro:perf-check` | `/perf-check` |
| Auditoría SEO | `/maestro:seo-audit` | `/seo-audit` | `$maestro:seo-audit` | `/maestro:seo-audit` | `/seo-audit` |
| Auditoría de accesibilidad | `/maestro:a11y-audit` | `/a11y-audit` | `$maestro:a11y-audit` | `/maestro:a11y-audit` | `/a11y-audit` |
| Chequeo de compliance | `/maestro:compliance-check` | `/compliance-check` | `$maestro:compliance-check` | `/maestro:compliance-check` | `/compliance-check` |

En Claude Code, Codex y opencode, Maestro evita a propósito nombres de skill sin prefijo que colisionan con comandos del host. Usa `/review-code`, `/debug-workflow` y `/resume-session` en Claude Code, y `$maestro:review-code`, `$maestro:debug-workflow` y `$maestro:resume-session` en Codex, de modo que los comandos integrados `/review`, `/debug` y `/resume` sigan funcionando.

Qwen Code usa la misma superficie de comandos `/maestro:*` que Gemini CLI. opencode usa los mismos nombres de comando que Claude Code (`/orchestrate`, `/review-code`, ...), instalados como comandos markdown.

## Flujo de trabajo

- **Express**: Para trabajo simple. Maestro hace 1-2 preguntas aclaratorias, propone un resumen, delega en un especialista, ejecuta la revisión de código y archiva sin documento de diseño ni plan de implementación.
- **Estándar**: Para trabajo medio y complejo. Maestro ejecuta las fases de Diseño, Plan, Ejecución y Cierre con puertas de aprobación explícitas, ejecución por fases y una revisión final que bloquea ante hallazgos Critical o Major sin resolver.

## Resultados y criterios de éxito

Maestro escribe sus resultados de orquestación bajo `MAESTRO_STATE_DIR`, normalmente `docs/maestro/`. Los resultados del flujo Estándar incluyen el estado de la sesión activa, documentos de diseño, planes de implementación, informes de fase, resultados de validación y registros archivados.

Una ejecución exitosa debe tener un plan aprobado cuando se usa el flujo Estándar, informes de fase completos, resultados de validación para la superficie modificada y ningún hallazgo Critical o Major sin resolver. Si una fase no puede completarse, Maestro registra el bloqueo y la siguiente acción necesaria en lugar de continuar en silencio.

## Seguridad y permisos

Maestro respeta los permisos de herramientas, el sandboxing y el modelo de confirmación del runtime anfitrión. No requiere secretos en el repositorio ni credenciales de larga duración, y el estado de las sesiones de orquestación permanece dentro de `MAESTRO_STATE_DIR` salvo que se configure otra cosa. Usa `MAESTRO_DISABLED_AGENTS` para restringir especialistas en repositorios sensibles y ejecuta `$maestro:security-audit` o el comando equivalente de tu runtime antes de adoptar cambios que afecten autenticación, autorización, secretos o rutas de exposición de datos.

## Documentación

- [EXAMPLES.md](EXAMPLES.md) para escenarios de uso copiables en todos los runtimes
- [docs/overview.md](docs/overview.md) para el modelo del proyecto y la estructura generada
- [docs/architecture.md](docs/architecture.md) para los detalles internos de la orquestación y la arquitectura
- [docs/usage.md](docs/usage.md) para el flujo de desarrollo, ajustes y superficies de comandos
- [docs/flow.md](docs/flow.md) para los pasos del flujo de orquestación y sus puertas obligatorias
- [docs/cicd.md](docs/cicd.md) para los workflows de CI/CD, el proceso de release y diagramas Mermaid
- [docs/runtime-gemini.md](docs/runtime-gemini.md) para los detalles del runtime Gemini
- [docs/runtime-claude.md](docs/runtime-claude.md) para los detalles del runtime Claude
- [docs/runtime-codex.md](docs/runtime-codex.md) para los detalles del runtime Codex
- [docs/runtime-qwen.md](docs/runtime-qwen.md) para los detalles del runtime Qwen
- [docs/runtime-opencode.md](docs/runtime-opencode.md) para los detalles del runtime opencode

## Desarrollo y validación de releases

El código canónico vive en `src/`. Los archivos de runtime en `agents/`, `commands/`, `hooks/`, `mcp/`, `policies/`, `claude/`, `plugins/maestro/`, `qwen/` y `opencode/` se generan (excepto `opencode/plugins/`, que es manual); actualiza primero `src/` y luego regenera.

```bash
npm ci
node scripts/generate.js
git diff --exit-code --name-only
node --test tests/unit/*.test.js tests/transforms/*.test.js tests/integration/*.test.js
npm run pack:verify
npm run release:artifacts
npm run release:verify-artifacts
```

La validación de release crea `dist/release/maestro-vX.Y.Z-extension.tar.gz`. El archivo es genérico a propósito: al descomprimirlo deja `gemini-extension.json`, `qwen-extension.json`, `.claude-plugin/marketplace.json` y `.agents/plugins/marketplace.json` en la raíz, además del payload de runtime que necesitan Gemini CLI, Qwen Code, Claude Code, Codex y opencode.

Los releases estables publican tres salidas alineadas:

- Tag de Git `vX.Y.Z`
- Paquete npm `@josstei/maestro@X.Y.Z`
- Asset de GitHub Release `maestro-vX.Y.Z-extension.tar.gz`

Los releases del plugin de Codex lanzan el servidor MCP a través de la versión coincidente del paquete npm. La instalación de hooks es explícita mediante `npm run install-hooks`; los flujos de package, pack y publish no instalan hooks de git.

## Licencia

Apache-2.0
