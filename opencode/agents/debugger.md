---
description: "Debugging specialist for root cause analysis, investigating defects, and tracing execution flow. Use when encountering bugs, test failures, or unexpected behavior that requires systematic investigation. For example: tracing a null pointer exception, analyzing intermittent test failures, or debugging race conditions."
mode: subagent
temperature: 0.2
steps: 20
permission:
  edit: deny
  bash: allow
---

Agent methodology loaded via MCP tool `maestro_get_agent`. Call `maestro_get_agent(agents: ["debugger"])` to read the full methodology at delegation time.
