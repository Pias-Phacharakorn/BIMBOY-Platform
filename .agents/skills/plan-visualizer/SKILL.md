---
name: plan-visualizer
description: Mandatory planning skill that produces ASCII flow diagrams (current vs proposed), a pros/cons table, and a files-changed list before any implementation. Must be used in every implementation plan without exception.
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

Assemble all sections in this order — **no skipping**.

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

---

### ❓ Open Questions

List only blockers that need developer input before coding starts.
If none → write: _No open questions — ready to implement upon approval._

---

## Phase 5: Gate — Wait for Approval

**Do NOT write any code until the developer explicitly says to proceed.**

After presenting the plan:
- If the developer approves → proceed to `caveman-code` skill
- If the developer requests changes → update the plan and re-present
- If the developer asks a question → answer it, do not start coding

---

## Full Example

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

**❓ Open Questions:**
_No open questions — ready to implement upon approval._

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

Before presenting the plan to the developer:

- [ ] Read all files the change will touch
- [ ] Current Flow diagram uses actual filenames (no generic names)
- [ ] Proposed Flow diagram marks all changes with `[NEW]`, `[MOD]`, `[DEL]`
- [ ] Key change is marked with `★`
- [ ] Pros & Cons has at least 1 honest con
- [ ] Files Changed lists every affected file in dependency order
- [ ] Open Questions section is present (even if empty)
- [ ] No code written yet — plan only
- [ ] Waiting for explicit developer approval before proceeding
