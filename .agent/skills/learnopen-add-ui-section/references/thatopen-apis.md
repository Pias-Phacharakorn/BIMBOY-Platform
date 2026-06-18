# @thatopen APIs for UI Integrations (v3.4.x)

## Core Registry Pattern
Every tool and manager is accessed via the `OBC.Components` instance.

```typescript
import * as OBC from "@thatopen/components";

// Initialize components first!
await components.init();

// Retrieve tools
const fragments = components.get(OBC.FragmentsManager);
```

## FragmentsManager (Model Data)
Use `FragmentsManager` to track loaded models and their metadata.

```typescript
import * as OBC from "@thatopen/components";

const fragments = components.get(OBC.FragmentsManager);

// Listen to new models
fragments.onFragmentsLoaded.add((model) => {
    const uuid = model.uuid;
    const properties = model.getLocalProperties();
});
```

## Highlighter (Selection Events)
The `Highlighter` module handles clicking and selecting elements in the 3D scene.
> **WARNING:** `@thatopen/components-front` tools are **browser-only**.

```typescript
// browser-only — do not import in Node/SSR
import * as OBCF from "@thatopen/components-front";

const highlighter = components.get(OBCF.Highlighter);

highlighter.events.select.onHighlight.add((selection) => {
    // selection maps Fragment ID to a Set of Item IDs
    for (const fragmentId in selection) {
        const itemIds = selection[fragmentId];
        console.log(`Selected ${itemIds.size} items in fragment ${fragmentId}`);
    }
});
```

## @thatopen/ui-obc Tables
This package provides pre-built Web Components for displaying BIM data.

```typescript
import * as CUI from "@thatopen/ui-obc";

const [modelsList] = CUI.tables.modelsList({
    components,
    metaDataTags: ["schema"], // Optional metadata config
    actions: { download: true },
});
```
