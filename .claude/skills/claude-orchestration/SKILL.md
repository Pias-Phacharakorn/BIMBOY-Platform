---
name: claude-orchestration
description: Formal guidelines and templates for orchestrating tasks using Claude Code CLI and auditing the output.
category: workflow
---

# Claude Orchestration Skill

Use this skill when preparing specs for Claude Code CLI and reviewing its output.

---

## 📝 1. Spec Generation Blueprint

When constructing the prompt for Claude Code CLI (`claude -p "<spec>"`), you **MUST** format it as follows:

```
You are editing the codebase for BIMBOY.
Authoritative rules are defined in c:\Users\PhacharakornMuangkae\AppData\Roaming\_GitHub Port\BIM-BOY\AGENTS.md. 

CRITICAL: Before making ANY changes or analyzing code, read AGENTS.md in full:
c:\Users\PhacharakornMuangkae\AppData\Roaming\_GitHub Port\BIM-BOY\AGENTS.md

### 📁 Target Files
- [file basename](file:///path/to/file) (Role/Action: MODIFY / NEW / DELETE)

### 📌 Requirements
[Detailed requirements for the task]

### 📐 Layer & Constraints Reminder
1. No relative imports (use `@/*` aliases).
2. No `<bim-*>` Web/BUI components outside ViewportWrapper.tsx.
3. No store hooks/useEffect/fetching inside routes/ (routes are composition only).
4. No React component state for layouts/modals (use uiStore).
5. No Supabase direct queries in components/ or views/ (move to features/).
6. Pinned ThatOpen library version v3.4.x.
```

---

## 🛠️ 2. Execution Runbook

1. Prepare the spec following the blueprint.
2. Run Claude Code CLI non-interactively from the workspace root:
   ```powershell
   claude -p "<spec>" --permission-mode bypassPermissions
   ```
3. Do not run interactive sessions; specify all required steps in the prompt.

---

## 🔍 3. Diff Audit Checklist

Once Claude completes, run `git diff` and perform a line-by-line review of all modifications against this checklist:

### 📦 Import Check
- [ ] Every modified or new file uses `@/` path alias.
- [ ] No relative path imports like `../../` are present.

### 🪟 BUI & Shadow DOM Check
- [ ] No `<bim-*>` components (e.g. `<bim-grid>`, `<bim-panel>`, etc.) were introduced outside `ViewportWrapper.tsx`.
- [ ] Theme customizations only use CSS variables in `style.css`.

### 🧭 Routing & View Composition Check
- [ ] No state hooks, `useEffect`, or fetch functions inside files under `routes/`.
- [ ] No files or folders created directly under `react-components/` root.
- [ ] Views under `views/` are flat (no subdirectories) and composition-only.

### 💾 Store & State Check
- [ ] Component layouts, modal states, and collapse states are managed in `uiStore`.
- [ ] No local React state (`useState`) is used for layout positioning or toggles.
- [ ] Zustand stores contain state definitions only and do not render React code.

### 🔬 BIM & ThatOpen Check
- [ ] Custom components extending `OBC.Component` implement `Disposable`.
- [ ] Custom components are registered inside `bim-components/setup/`.
- [ ] All meshes are disposed of using `OBC.Disposer`.

---

## 🔄 4. Recovery & Refinement Loop

* **Major Violations:** If Claude violates structural rules (e.g., placing logic in routes, using relative imports, or adding `<bim-*>` in other components), run `git checkout` to discard the changes, update the spec to explicitly forbid the violation, and re-run Claude.
* **Minor Slipups:** If the code is correct but contains a simple typo, a single missing import, or a small syntax mistake, patch the file directly and note it in the review summary.
