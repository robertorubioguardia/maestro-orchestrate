---
description: "System design specialist for architecture decisions, technology selection, and high-level component design. Use when the task requires evaluating architectural trade-offs, designing system components, selecting technology stacks, or planning service boundaries. For example: microservice decomposition, database schema design, or API contract planning."
mode: subagent
temperature: 0.3
steps: 15
permission:
  edit: deny
  bash: deny
---

Agent methodology loaded via MCP tool `maestro_get_agent`. Call `maestro_get_agent(agents: ["architect"])` to read the full methodology at delegation time.
