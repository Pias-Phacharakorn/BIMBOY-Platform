---
name: plan-visualizer
description: Mandatory planning skill with two modes — a default lean "AI read" plan (Objective / Steps / Files / Risks) for an agent to execute, and a heavy "Human read" plan (ASCII current-vs-proposed flow diagrams, pros/cons, files-changed list) when the developer is the one approving. Use before any implementation — every non-trivial plan runs through this skill and its approval gate.
license: MIT
category: planning
---

# Plan Visualizer — Implementation Plan Standard

## Invoke This Skill When
- Creating **any** implementation plan before writing code
- Proposing architecture changes, new features, refactors, or bug fixes
- Asked to "plan", "propose", "design", or "implement" anything non-trivial
- After completing a `grill-with-docs` session and ready to produce the final plan

---

## Mode Selection — read this first

This skill has two output modes. Pick one before writing anything, based on **who the plan is for**:

- **AI read (default)** — the plan is scaffolding for an agent to execute. Lean, actionable, no diagrams. Use this unless a human is specifically the one reviewing for a go/no-go decision.
- **Human read** — the plan is for the *developer* to understand and approve. Heavy visual format: ASCII current-vs-proposed flow diagrams, pros/cons, files-changed. Use when the developer is the audience — e.g. they explicitly typed `/plan-visualizer`, or you're presenting a design decision for their sign-off before committing to a direction.

Rule of thumb: **"Is a human about to approve this?" → Human read. "Is this the agent organizing its own execution work?" → AI read.**

### The approval gate is universal

**Format differs by mode; the approval gate does not.** Both modes stop and wait for explicit developer approval before any code is written. Approve once per task, in whichever format was presented.

The one exception: an **AI-read plan that is downstream of an already-approved plan** does not re-ask. Example — in the `fable-advisor` flow the developer already approved the Human-read plan, so the Sonnet execution sub-agent writing its own AI-read step list to carry that plan out does not pause for a second approval. You already said yes once.

---

# Mode 1 — AI read (default)

A lean plan optimized for an agent to execute, not for a human to eyeball. Follow your own best practices for structure — but the plan must contain at least this floor:

- **Objective** — one line: what's being built.
- **Steps** — ordered and concrete, each tied to a specific file/function. This is the actual execution sequence.
- **Files touched** — flat list, each tagged `[NEW]` / `[MOD]` / `[DEL]`.
- **Risks / watch-outs** — anything the executor must not trip on: edge cases, layer boundaries (see `AGENTS.md`), side effects on other consumers of a shared store/component.

No ASCII diagrams, no pros/cons table, no prose padding. Bullets vs numbered lists, header choices — your judgment per task. Keep it tight; every line should earn its place for an agent about to act on it.

Then **wait for approval** (see the universal gate above) unless this plan is downstream of one already approved.

---

# Mode 2 — Human read

The full visual format, for when the developer is reviewing. Work through these phases in order — no skipping.

## Phase 1: Gather Context

Before drawing anything, orient yourself in the codebase.

1. **Read the files involved** — open every file the change will touch
2. **Trace the data flow** — follow state from store → feature → component → UI
3. **Identify the layer boundary** — which layer does the change live in? (see `AGENTS.md` layer table)
4. **Check for side effects** — will this change affect other consumers of the same store/component?

> Do NOT start drawing diagrams until you can answer: _"What is the exact current flow, file by file?"_

---

## Phase 2: Draw the Current Flow

Show how things work **right now**, before any change.

**Rules:**
- Use ASCII box + arrow style (see Cheat Sheet below)
- Label every box with the **actual filename** — no generic names
- Show data direction with arrows (`→`, `←`, `↓`, `↑`)
- Annotate boxes with `←` inline comments explaining their role
- Maximum 15 boxes — group/simplify if larger
- For UI changes: draw the UI layout as a box wireframe, not a component tree

**Template — Data Flow:**
```
┌─────────────────────┐
│  ComponentA.tsx     │  ← owns X state
└────────┬────────────┘
         │ props: { data }
         ▼
┌─────────────────────┐
│  featureStore.ts    │  ← Zustand slice
└────────┬────────────┘
         │ calls
         ▼
┌─────────────────────┐
│  supabaseClient.ts  │  ← fetches from DB
└─────────────────────┘
```

**Template — UI Layout:**
```
┌──────────────────────────────┐
│  Toolbar                     │
│  [Button A]  [Button B]      │  ← two separate actions
└──────────────────────────────┘
```

---

## Phase 3: Draw the Proposed Flow

Show the **new** flow after the change. Diff against the current flow visually.

**Rules:**
- Same format as Phase 2
- Mark new boxes with `[NEW]`
- Mark modified boxes with `[MOD]`
- Mark removed items below the diagram as `~~name — reason~~`
- Put `★` on the arrow or box that is the **key change** — the single most important difference
- If only UI changes: draw the new UI layout wireframe

**Template — Data Flow:**
```
┌─────────────────────┐
│  ComponentA.tsx     │  ← [MOD] now dispatches action
└────────┬────────────┘
         │ ★ new: dispatches setSelected(id)
         ▼
┌─────────────────────┐
│  NewFeature.tsx     │  ← [NEW] owns selection logic
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  featureStore.ts    │  ← [MOD] adds selectedId field
└─────────────────────┘

Removed: ~~ComponentC.tsx — logic moved into NewFeature.tsx~~
```

**Template — UI Layout:**
```
┌──────────────────────────────┐
│  Toolbar                     │
│  [Load Model ▾]              │  ← ★ single dropdown [MOD]
└──────────────────────────────┘
         │ click
         ▼
┌──────────────────────────┐
│ ☁  Cloud Models          │  ← opens modal [NEW]
├──────────────────────────┤
│ 📁 Local Model           │  ← label
│    □  Load IFC           │  ← file picker
│    □  Load FRAG          │  ← file picker
└──────────────────────────┘
```

---

## Phase 4: Write the Plan Document

Assemble all sections in this order — **no skipping**. Author it here in the skill; do **not** hand plan-writing to `caveman-code` (that's the post-approval execution step, see Phase 5).

---

### 📌 Goal
One sentence. What problem does this solve and for whom?

---

### 🔄 Current Flow
_(paste diagram from Phase 2)_

---

### ✅ Proposed Flow
_(paste diagram from Phase 3)_

---

### ⚖️ Pros & Cons

| Pros | Cons |
| :--- | :--- |
| Concrete benefit 1 | Real trade-off or risk 1 |
| Concrete benefit 2 | Real trade-off or risk 2 |

- Keep to 2–4 rows each
- Be honest about cons — **never omit real trade-offs**
- If a con has a mitigation, note it: `Slower initial load (mitigated by lazy load)`

---

### 📁 Files Changed

Tag every file with `[NEW]`, `[MOD]`, or `[DEL]`. List in dependency order (dependencies first).

```
[MOD] src/react-components/store/uiStore.ts
[NEW] src/react-components/features/cloud-models/CloudModelPanel.tsx
[MOD] src/react-components/views/models/ModelsView.tsx
[DEL] src/react-components/components/bim/OldButton.tsx
```

> No "Open Questions" section — the `grill-with-docs` step earlier in the workflow already surfaces and resolves questions up front. By the time you write this plan, there should be nothing left to ask; if a real blocker somehow remains, raise it directly instead of burying it in the doc.

---

## Phase 5: Gate — Wait for Approval

**Do NOT write any code until the developer explicitly says to proceed.**

After presenting the plan:
- If the developer approves → proceed to implementation via `caveman-code`
- If the developer requests changes → update the plan and re-present
- If the developer asks a question → answer it, do not start coding

---

## Full Example (Human read)

> Request: "Merge the Load Model and Cloud Models toolbar buttons into one dropdown."

---

**📌 Goal:** Replace two separate toolbar buttons with a single dropdown to reduce toolbar clutter and make Cloud the primary load path.

---

**🔄 Current Flow:**
```
┌──────────────────────────────────────┐
│  ViewportToolbar.tsx                 │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ToolbarLoadModel.tsx        │    │
│  │  [Load Model ▾] [Cloud ☁]   │  ← two separate buttons
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
         │                    │
    click → dropdown     click → setCloudModalOpen(true)
    (IFC / FRAG only)    (uiStore)
```

---

**✅ Proposed Flow:**
```
┌──────────────────────────────────────┐
│  ViewportToolbar.tsx                 │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ToolbarLoadModel.tsx [MOD]  │    │
│  │  [Load Model ▾]              │  ← ★ single entry point
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
         │ click opens dropdown
         ▼
┌──────────────────────────┐
│ ☁  Cloud Models          │  ← setCloudModalOpen(true)
├──────────────────────────┤
│ 📁 Local Model           │  ← section label (non-clickable)
│    □  Load IFC           │  ← file picker .ifc
│    □  Load FRAG          │  ← file picker .frag
└──────────────────────────┘
```

---

**⚖️ Pros & Cons:**

| Pros | Cons |
| :--- | :--- |
| Cleaner toolbar — one entry point | One extra click to reach local file load |
| Cloud is visually the primary action | Slightly more UI to scan in the dropdown |
| Easier to add more load sources later | |

---

**📁 Files Changed:**
```
[MOD] src/react-components/components/bim/ToolbarLoadModel.tsx
[MOD] src/globals.ts  ← added CHEVRON_DOWN, FOLDER, FILE icons
```

---

## Diagram Cheat Sheet

```
Boxes:        ┌───┐  │  └───┘  ├───┤
Arrows:       → ← ↑ ↓
Key change:   ★  (put on the most important arrow or box)
Tags:         [NEW]  [MOD]  [DEL]
Annotations:  ← inline comment after the box
Removed:      ~~FileName.tsx — reason for removal~~
UI elements:  [Button label]  ▾ (dropdown indicator)
Icons in UI:  ☁ 📁 □ ✓ ★
```

---

## Checklist

**AI read** — before presenting:
- [ ] Objective is one line
- [ ] Steps are ordered and each tied to a file/function
- [ ] Files touched are tagged `[NEW]`/`[MOD]`/`[DEL]`
- [ ] Risks/watch-outs noted (layer boundaries, side effects)
- [ ] No code written yet — waiting for approval (unless downstream of an approved plan)

**Human read** — before presenting:
- [ ] Read all files the change will touch
- [ ] Current Flow diagram uses actual filenames (no generic names)
- [ ] Proposed Flow diagram marks all changes with `[NEW]`, `[MOD]`, `[DEL]`
- [ ] Key change is marked with `★`
- [ ] Pros & Cons has at least 1 honest con
- [ ] Files Changed lists every affected file in dependency order
- [ ] No code written yet — plan only
- [ ] Waiting for explicit developer approval before proceeding
