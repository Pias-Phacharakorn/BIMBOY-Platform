<!--
  plan-visualizer reusable template
  =================================
  Copy this file to <project-root>/plan-visualizer.md and fill every {{PLACEHOLDER}}.
  Keep the heading structure and section order — only fill placeholders, and if a section
  has nothing to show (e.g. no removed items), delete that section entirely.
  Delete this comment block in the output file.

  Placeholders:
    {{GOAL_SHORT}}             - 3-6 word title, used in the H1
    {{GOAL_ONE_SENTENCE}}      - one sentence: what problem, for whom
    {{CURRENT_FLOW_MERMAID}}   - Mermaid flowchart body, current state (no fence — fence is already in place)
    {{PROPOSED_FLOW_MERMAID}}  - Mermaid flowchart body, proposed state
    {{REMOVED_ITEMS_LIST}}     - one `- ~~File.tsx~~ — reason` per item, or delete the whole section
    {{PROS_CONS_ROWS}}         - one `| pro | con |` table row per line, 2-4 rows
    {{FILES_CHANGED_LIST}}     - one file per line, tagged [NEW]/[MOD]/[DEL], dependency order
    {{OPEN_QUESTIONS_OR_NONE}} - blockers as a list, or "No open questions — ready to implement upon approval."

  Mermaid node conventions (flowchart TD, top-down, unless UI layout reads better as LR):
    Node:   Id["ActualFile.tsx<br/>role annotation"]
    Edge:   A --> B          A -->|label| B
    Tags:   prefix label text with [NEW] or [MOD] inside the node string
    Key change: put a ★ inside the single most important edge label
    Max 15 nodes per diagram — group/simplify if larger
    Removed items go in the Removed section below the diagram, never inside the Mermaid graph
    Quote any label containing (), &, or : — Id["fetch(url) & parse"]
-->

# 📌 {{GOAL_SHORT}}

{{GOAL_ONE_SENTENCE}}

## 🔄 Current Flow

```mermaid
{{CURRENT_FLOW_MERMAID}}
```

## ✅ Proposed Flow

```mermaid
{{PROPOSED_FLOW_MERMAID}}
```

### Removed

{{REMOVED_ITEMS_LIST}}

## ⚖️ Pros & Cons

| Pros | Cons |
| --- | --- |
{{PROS_CONS_ROWS}}

## 📁 Files Changed

```text
{{FILES_CHANGED_LIST}}
```

## ❓ Open Questions

{{OPEN_QUESTIONS_OR_NONE}}
