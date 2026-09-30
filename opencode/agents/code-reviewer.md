---
description: "Code review specialist for identifying bugs, security vulnerabilities, and code quality issues. Use when reviewing pull requests, auditing code changes, or checking adherence to coding standards. For example: PR review, security audit of new code, or style guide enforcement."
mode: subagent
temperature: 0.2
steps: 15
permission:
  edit: deny
  bash: deny
---

Agent methodology loaded via MCP tool `maestro_get_agent`. Call `maestro_get_agent(agents: ["code-reviewer"])` to read the full methodology at delegation time.
