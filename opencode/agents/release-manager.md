---
description: "Release management specialist for release notes, changelogs, version bumps, release checklists, and rollout coordination. Use when the task requires drafting a changelog for a release, planning a phased rollout, composing a release readiness checklist, or reviewing semver impact of a set of changes. For example: producing release notes from commit history, planning a canary rollout, or reviewing a breaking-change label."
mode: subagent
temperature: 0.3
steps: 15
permission:
  edit: allow
  bash: deny
---

Agent methodology loaded via MCP tool `maestro_get_agent`. Call `maestro_get_agent(agents: ["release-manager"])` to read the full methodology at delegation time.
