# Query Builder UI Integration

ThatOpen provides pre-built Web Components to create dynamic query builders where users can define their own rules visually.

## Using `@thatopen/ui-obc`

The `CUI.tables.queryBuilder` function generates a complete UI for managing queries.

```typescript
// src/ui-templates/sections/queries.ts
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as CUI from "@thatopen/ui-obc";
import { appIcons } from "../../globals";

export interface QueriesPanelState {
  components: OBC.Components;
}

export const queriesPanelTemplate: BUI.StatefullComponent<
  QueriesPanelState
> = (state) => {
  const { components } = state;

  // 1. Initialize the query builder table
  // This automatically binds to the OBCQ.Queries manager
  const [queryBuilder] = CUI.tables.queryBuilder({
    components,
  });

  queryBuilder.preserveStructureOnFilter = true;

  // 2. Return the panel section containing the builder
  return BUI.html`
  <bim-panel-section fixed icon=${appIcons.SEARCH} label="Queries">
    ${queryBuilder}
  </bim-panel-section>`;
};
```

## How It Works

1. **Automatic Binding**: The `queryBuilder` component internally retrieves the `OBCQ.Queries` instance from your `components` registry.
2. **Dynamic Rules**: Users can click "Add Rule" in the UI to select IFC types, properties, and values.
3. **Execution**: When the user clicks the "Run" or "Filter" button in the UI, the component automatically updates the query and isolates the elements in the 3D viewer (if the Highlighter is configured to listen to selection events, or if the component handles visibility).

## SmartViews List

You can also display a list of pre-defined queries (SmartViews) using a standard BUI list component, and bind the click events to execute those specific queries.

```typescript
const onSmartViewClick = async (queryName: string) => {
    const queries = components.get(OBCQ.Queries);
    const query = queries.list.get(queryName);
    if (query) {
        await query.update();
        const highlighter = components.get(OBCF.Highlighter);
        highlighter.highlightByID("select", query.fragments, true, true);
    }
}
```
