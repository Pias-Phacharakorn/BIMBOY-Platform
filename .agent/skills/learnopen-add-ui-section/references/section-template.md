# Canonical Section Template

This is a copy-paste ready reference implementation for creating a new BIM sidebar section. It is heavily based on the `models.ts` pattern.

```typescript
// src/ui-templates/sections/feature-name.ts
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as CUI from "@thatopen/ui-obc"; // If using pre-built tables
import { appIcons } from "../../globals";

// Define the state needed for this panel
export interface FeatureNamePanelState {
  components: OBC.Components;
}

// Export the template factory
export const featureNamePanelTemplate: BUI.StatefullComponent<
  FeatureNamePanelState
> = (state) => {
  const { components } = state;

  // 1. Retrieve necessary tools or managers
  const fragments = components.get(OBC.FragmentsManager);

  // 2. Setup any child components (e.g., tables or buttons)
  // Example: using a pre-built table from CUI
  const [dataTable] = CUI.tables.modelsList({
    components,
    actions: { download: false },
  });

  // 3. Define event handlers
  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    // Perform search logic, e.g.
    dataTable.queryString = input.value;
  };

  // 4. Return the BUI HTML template
  return BUI.html`
  <bim-panel-section fixed icon=${appIcons.INFO} label="Feature Name">
    <div style="display: flex; gap: 0.5rem; flex-direction: column;">
      <bim-text-input @input=${onSearch} placeholder="Search..." debounce="100"></bim-text-input>
      
      <!-- Inject child components directly -->
      ${dataTable}
    </div>
  </bim-panel-section>`;
};
```
