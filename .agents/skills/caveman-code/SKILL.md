---
name: caveman-code
description: >-
  Uses caveman-code, a highly token-efficient terminal-based AI coding assistant.
  Use when asked to run caveman commands, write code using caveman, start a caveman goal,
  or perform token-efficient coding tasks.
---

# caveman-code Skill

Use `caveman-code` to run coding tasks, generate code, or launch autonomous coding loops while optimizing token usage.

## Invoke This Skill When
- The developer asks to use `caveman` or `caveman-code`.
- You want to delegate tasks to a highly compressed, token-efficient local coding agent.
- You need to run an autonomous loop using `caveman goal start`.

## Prerequisites
- The global npm package `@juliusbrussee/caveman-code` must be installed.
- Set up target provider keys as environment variables if needed (e.g., `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

## Core Commands

### 1. Launch Interactive TUI
To start the interactive terminal interface:
```bash
caveman
```

### 2. One-Shot Prompt
To ask a specific coding question or run a task directly:
```bash
caveman "explain this codebase"
```

### 3. Run Autonomous Goal Loop
To start an autonomous loop targeting a specific objective:
```bash
caveman goal start "implement user auth"
```

### 4. Custom Model Configuration
You can specify providers and models directly:
```bash
caveman --model gemini/gemini-1.5-pro "refactor index.js"
```
