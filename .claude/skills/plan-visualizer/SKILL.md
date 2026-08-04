---
name: plan-visualizer
description: Mandatory planning skill that writes a self-contained plan-visualizer.md (Mermaid current/proposed diagrams, pros/cons, files changed) to the project root before any implementation. Must be used in every implementation plan without exception.
license: MIT
category: planning
---

# Plan Visualizer

Read `references/template.md` first — it is the deliverable's template and cheat sheet
(placeholders + Mermaid node conventions are documented in an HTML comment at its top).

## Invoke When
- Before writing code for any non-trivial feature, refactor, or bug fix
- Asked to "plan", "propose", "design", or "implement" something non-trivial
- After a `grill-with-docs` session, to produce the final plan

## Phase 1: Gather Context
Read every file the change touches. Trace data flow store → feature → component → UI.
Don't draw anything until you can state the current flow file-by-file.

## Phase 2–3: Draw Current & Proposed Flow
One Mermaid `flowchart` per side, per the conventions in `references/template.md`:
real filenames only, `[NEW]`/`[MOD]` prefixes, `★` on the key edge, max 15 nodes,
removed items listed under the diagram (not inside it).

## Phase 4: Write `plan-visualizer.md`
Copy `references/template.md` to `<project-root>/plan-visualizer.md`, fill every
`{{PLACEHOLDER}}`, delete the template's leading comment block, overwrite if it already
exists. This file is the entire deliverable — no plan content goes into the chat reply.

Diagrams must live in ` ```mermaid ` fenced blocks so they render in VS Code preview
(built-in since VS Code 1.121) and on GitHub with nothing installed.

## Phase 5: Gate — Wait for Approval
Reply in chat with **only**: the file path, one sentence restating the Goal, and a prompt
to open it in Markdown preview (`Ctrl+Shift+V`) and say approve or request changes.
Do not paste plan content into chat.

- Approved → proceed to `caveman-code`
- Changes requested → edit `plan-visualizer.md` in place, repeat the same short reply
- Question asked → answer it, do not start coding
- **Never write code before explicit approval.**

## Checklist
- [ ] Read every file the change touches; current flow traced file-by-file
- [ ] Both diagrams use real filenames; `[NEW]`/`[MOD]`/`★` applied; ≤15 nodes each
- [ ] Diagrams are in ` ```mermaid ` fences; labels with `()`/`&`/`:` are quoted
- [ ] Removed items listed below the Proposed diagram, not inside it
- [ ] Pros & Cons has at least one honest con
- [ ] Files Changed lists every file, tagged, dependency order
- [ ] Template comment block deleted from the output file
- [ ] `plan-visualizer.md` written to the project root, previous run overwritten
- [ ] Chat reply is path + one sentence only — no plan content pasted in chat
- [ ] Waiting for explicit approval before writing any code
