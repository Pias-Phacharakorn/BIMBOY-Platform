# CLAUDE.md

**Before doing anything in this repository, read [AGENTS.md](./AGENTS.md) in full.**

`AGENTS.md` is the authoritative guide for this project — it defines project identity, tech stack, architecture rules, file placement, naming conventions, hard constraints, and the mandatory workflow (read → plan → execute). All rules and constraints in `AGENTS.md` apply and take precedence over general defaults.

**Execution model:** Gemini acts as orchestrator + spec writer, not the direct code author. Gemini defines the task and writes the spec, then invokes **Claude Code CLI** (`claude -p "<spec>" --permission-mode bypassPermissions`) to think about the code and write/edit files. The developer approves the final diff before merge. Full loop is defined in AGENTS.md → **🤝 Multi-Agent Workflow**.

**Applies to every AI working in this repo, regardless of which agent:** grill requirements (`grill-with-docs`) → visualize the plan (`plan-visualizer`) → wait for explicit developer approval → implement. After implementation, never prompt or offer to `git add`/commit/merge — present the result and stop; the developer commits personally.
