# @thatopen/components-query APIs (v3.4.x)

The `@thatopen/components-query` package provides advanced filtering and logic evaluation for BIM models.

## Query Rules

A Query is composed of one or multiple Rules. A rule defines the criteria for matching an element.

```typescript
import * as OBCQ from "@thatopen/components-query";

const queries = components.get(OBCQ.Queries);

const structuralQuery = queries.create({
  name: "Structural Elements",
  rules: [
    {
      action: "includes", // "includes" | "excludes"
      type: "IfcWall",    // The IFC entity type to match
    },
    {
      action: "includes",
      type: "IfcSlab",
    }
  ]
});

// Update the query to evaluate it against the loaded models
await structuralQuery.update();

// The results are stored in the 'fragments' property
const results = structuralQuery.fragments;
```

## Property-based Queries

You can filter not just by IFC type, but by specific property values. Note: The model's properties must be loaded and indexed.

```typescript
const fireRatedQuery = queries.create({
  name: "Fire Rated Doors",
  rules: [
    {
      action: "includes",
      type: "IfcDoor",
    },
    {
      action: "includes",
      property: "FireRating",
      value: "60min"
    }
  ]
});
```

## Integrating with Highlighter

Once you have a `FragmentIdMap` from the query results, you can pass it to the Highlighter to isolate or emphasize those elements in the 3D scene.

```typescript
import * as OBCF from "@thatopen/components-front";

const highlighter = components.get(OBCF.Highlighter);

// highlightByID(selectionName, fragmentIdMap, clearPrevious, zoomToHighlight)
highlighter.highlightByID("select", structuralQuery.fragments, true, true);
```
