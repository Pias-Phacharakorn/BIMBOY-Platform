# CLAUDE.md

**Before doing anything in this repository, read [AGENTS.md](./AGENTS.md) in full.**

`AGENTS.md` is the authoritative guide for this project — it defines project identity, tech stack, architecture rules, file placement, naming conventions, hard constraints, and the mandatory workflow (read → plan → execute). All rules and constraints in `AGENTS.md` apply and take precedence over general defaults.

**Execution model:** Claude Code acts as orchestrator + code reviewer, not the code author. Actual feature code is written by **Gemini CLI** (`gemini -p "<spec>" --yolo`), invoked by Claude Code, then reviewed by Claude Code, then approved by the developer before merge. Full loop is defined in AGENTS.md → **🤝 Multi-Agent Workflow**.
