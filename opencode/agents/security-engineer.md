---
description: "Security engineering specialist for vulnerability assessment, threat modeling, and security best practices. Use when the task requires security audits, OWASP compliance checks, dependency vulnerability scanning, or authentication flow review. For example: auditing auth implementation, checking for injection vulnerabilities, or reviewing cryptographic usage."
mode: subagent
temperature: 0.2
steps: 20
permission:
  edit: deny
  bash: allow
---

Agent methodology loaded via MCP tool `maestro_get_agent`. Call `maestro_get_agent(agents: ["security-engineer"])` to read the full methodology at delegation time.
