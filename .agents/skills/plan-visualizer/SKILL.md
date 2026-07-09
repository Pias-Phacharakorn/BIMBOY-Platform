---
name: plan-visualizer
description: Mandatory planning skill that writes a self-contained plan-visualizer.html (Mermaid current/proposed diagrams, pros/cons, files changed) to the project root before any implementation. Must be used in every implementation plan without exception.
license: MIT
category: planning
---

# Plan Visualizer

Read `references/template.html` first — it is the deliverable's template and cheat sheet
(placeholders + Mermaid node conventions are documented as HTML comments at its top).

## Invoke When
- Before writing code for any non-trivial feature, refactor, or bug fix
- Asked to "plan", "propose", "design", or "implement" something non-trivial
- After a `grill-with-docs` session, to produce the final plan

## Phase 1: Gather Context
Read every file the change touches. Trace data flow store → feature → component → UI.
Don't draw anything until you can state the current flow file-by-file.

## Phase 2–3: Draw Current & Proposed Flow
One Mermaid `flowchart` per side, per the conventions in `references/template.html`:
real filenames only, `[NEW]`/`[MOD]` prefixes, `★` on the key edge, max 15 nodes,
removed items listed under the diagram (not inside it).

## Phase 4: Write `plan-visualizer.html`
Copy `references/template.html` to `<project-root>/plan-visualizer.html`, fill every
`{{PLACEHOLDER}}`, overwrite if it already exists. This file is the entire deliverable —
no plan content goes into the chat reply.

## Phase 5: Gate — Wait for Approval
Reply in chat with **only**: the file path, one sentence restating the Goal, and a prompt
to open it and say approve or request changes. Do not paste plan content into chat.

- Approved → proceed to `caveman-code`
- Changes requested → edit `plan-visualizer.html` in place, repeat the same short reply
- Question asked → answer it, do not start coding
- **Never write code before explicit approval.**

## Checklist
- [ ] Read every file the change touches; current flow traced file-by-file
- [ ] Both diagrams use real filenames; `[NEW]`/`[MOD]`/`★` applied; ≤15 nodes each
- [ ] Removed items listed below the Proposed diagram, not inside it
- [ ] Pros & Cons has at least one honest con
- [ ] Files Changed lists every file, tagged, dependency order
- [ ] `plan-visualizer.html` written to the project root, previous run overwritten
- [ ] Chat reply is path + one sentence only — no plan content pasted in chat
- [ ] Waiting for explicit approval before writing any code
