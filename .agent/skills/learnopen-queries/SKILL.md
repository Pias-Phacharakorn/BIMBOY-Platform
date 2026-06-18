---
name: learnopen-queries
description: Teaches how to work with the Query Builder and SmartViews in ThatOpen. Use when asked to "add a query", "create a smart view", "filter elements", or "show specific IFC elements based on rules". Covers `OBC.Indexer`, `OBCQ.Queries`, and mapping results to UI sections.
---

# LearnThatOpen — Queries and SmartViews

## Invoke This Skill When
- "add a query for doors and windows"
- "create a smart view for the structural model"
- "filter the 3D viewer to show specific IFC types"
- "use the query builder to highlight elements"
- "how do I run a custom query on the BIM data"

## Architecture Overview

ThatOpen provides powerful systems to query and isolate elements in complex IFC models. The core flow relies on the Indexer (which parses relations) and Queries (which executes rules).

| API Component | Purpose |
| --- | --- |
| `OBC.Indexer` | Indexes relations (like finding which storey a wall belongs to). |
| `OBCQ.Queries` | The engine that executes logical rules to find specific elements. |
| `OBCF.Outliner` / `Highlighter` | Used to visually isolate the query results in the 3D scene. |
| `SmartViews` | A custom wrapper in this project to persist/manage commonly used queries. |

## Step-by-Step Workflow

**Step 1 — Ensure Models are Indexed**
Before running advanced queries, the model must be indexed. This usually happens in the IFC loading pipeline.
```typescript
const indexer = components.get(OBC.Indexer);
// Called after fragments load
await indexer.process(model);
```

**Step 2 — Define Query Rules**
Fetch the `Queries` manager and define the rules (e.g., filtering by `IfcWall`).
```typescript
import * as OBCQ from "@thatopen/components-query";

const queries = components.get(OBCQ.Queries);
const myQuery = queries.create({
  name: "All Walls",
  rules: [
    {
      action: "includes",
      type: "IfcWall",
    }
  ]
});
```

**Step 3 — Execute the Query**
Update the query results. This returns a `FragmentIdMap` which represents the matching elements.
```typescript
await myQuery.update();
const matchingElements = myQuery.fragments; // FragmentIdMap
```

**Step 4 — Visualize the Results**
Use the Highlighter or Outliner to visually isolate the queried elements.
```typescript
import * as OBCF from "@thatopen/components-front";

const highlighter = components.get(OBCF.Highlighter);
highlighter.highlightByID("select", matchingElements, true, true);
```

## Common Mistakes
- **Querying before Indexing**: If the model hasn't been processed by `OBC.Indexer` or the properties aren't loaded, queries will return empty sets.
- **Incorrect IFC Types**: Using `IfcWall` instead of `IFCWALL` or vice versa depending on the specific property schema. Always verify the exact string stored in the model.
- **Not updating the query**: After creating rules, you must call `await myQuery.update()` before accessing the results.

## Reference Files
- `references/smart-views-api.md`: Deep dive into how `OBCQ.Queries` is structured, the available rule types (`includes`, `excludes`), and chaining logic.
- `references/query-builder-pattern.md`: How to hook the query engine into the `@thatopen/ui` query builder components for dynamic user-defined queries.
