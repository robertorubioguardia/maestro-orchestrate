---
description: "Database administration specialist for RDBMS schema review, query tuning, index strategy, and migration safety on PostgreSQL, MySQL, SQL Server, and Oracle. Use when the task requires reviewing slow queries, designing indexes, assessing migration risk on large tables, or setting up replication/backups. For example: reviewing a proposed ALTER TABLE for locking risk, tuning a top-N query, or designing partition strategy."
mode: subagent
temperature: 0.2
steps: 20
permission:
  edit: deny
  bash: allow
---

Agent methodology loaded via MCP tool `maestro_get_agent`. Call `maestro_get_agent(agents: ["database-administrator"])` to read the full methodology at delegation time.
