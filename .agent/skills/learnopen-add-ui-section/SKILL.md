---
name: learnopen-add-ui-section
description: Teaches how to add a new UI section or panel to the BIM viewer sidebar or top toolbar. Use this skill whenever the user asks to "add a new panel", "create a UI section", "show BIM data in the sidebar", "build a new BIM panel", or "add [feature] to the BIM viewer UI". It provides the step-by-step workflow for creating a section template using BUI, wiring it to @thatopen APIs, and instantiating it in the React application layout.
---

# LearnThatOpen — Add UI Section / Panel

## Invoke This Skill When
- "add a new panel / section / sidebar tab"
- "create a UI section for [feature]"
- "I want to show [BIM data] in the sidebar"
- "add a table / list / control panel to the viewer"
- "build a new BIM panel"
- "how do I add a section like models.ts"
- "create a section template"
- "add [feature] to the BIM viewer UI"

## Architecture Overview

| File Path | Purpose |
| --- | --- |
| `src/ui-templates/sections/` | Where new section factory templates are defined using `BUI.html`. |
| `src/ui-templates/containers/` | Sidebar (`viewport-toolbar.ts`) and top toolbar (`viewport-top-toolbar.ts`) containers where sections are registered. |
| `src/react-components/ProjectDetailsPage.tsx` | React component where BUI templates are instantiated and appended to the DOM. |
| `src/bim-components/setup/index.ts` | The core BIM setup file, ensuring `components.init()` happens before UI generation. |

## Step-by-Step Workflow

**Step 1 — Create the section template**
In `src/ui-templates/sections/`, create a new `[feature-name].ts` file. Export a factory function that takes an initialized `OBC.Components` state and returns a `bim-panel-section` element.
```typescript
// src/ui-templates/sections/example-section.ts
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";

export interface ExampleSectionState {
  components: OBC.Components;
}

export const exampleSectionTemplate: BUI.StatefullComponent<ExampleSectionState> = (state) => {
  const { components } = state;
  // Initialize logic here
  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.INFO} label="Example Panel">
      <div>My BIM Panel Content</div>
    </bim-panel-section>
  `;
};
```

**Step 2 — Wire data from @thatopen APIs**
Retrieve tools like `FragmentsManager` or `Highlighter` from the components registry to interact with BIM data.
```typescript
const fragments = components.get(OBC.FragmentsManager);
fragments.onFragmentsLoaded.add((model) => {
    console.log("Model loaded!", model.uuid);
});
```

**Step 3 — Register in the sidebar grid**
Add the section to `src/ui-templates/containers/viewport-toolbar.ts` (or `viewport-top-toolbar.ts`).
```typescript
import { exampleSectionTemplate } from "../sections/example-section";

// ... inside the toolbar template ...
const [exampleSection] = BUI.Component.create(exampleSectionTemplate, { components });
return BUI.html`
  <bim-toolbar>
    <bim-toolbar-section label="My Feature">
      ${exampleSection}
    </bim-toolbar-section>
  </bim-toolbar>
`;
```

**Step 4 — Instantiate in React**
In `src/react-components/ProjectDetailsPage.tsx`, within the effect where the BIM viewer is initialized, instantiate the BUI components. Ensure you await `components.init()`.

**Step 5 — Export and verify**
Export your section in `src/ui-templates/sections/index.ts`. Check the browser to ensure the UI renders and interacts with 3D elements correctly.

## @thatopen API Quick Reference

| API Element | Import Path | Description / Usage |
| --- | --- | --- |
| `Components` | `@thatopen/components` | Core registry: `components.get(OBC.FragmentsManager)` |
| `FragmentsManager` | `@thatopen/components` | Manage models: `fragments.groups` |
| `Highlighter` | `@thatopen/components-front` | Selection API. **Browser only!** |
| `BUI.html` | `@thatopen/ui` | Tagged template literal for BUI components. |
| `BUI.Component.create` | `@thatopen/ui` | Instantiates a stateful BUI component. |
| `CUI.tables` | `@thatopen/ui-obc` | Pre-built tables like `CUI.tables.modelsList()`. |

## Common Mistakes
- **Using JSX for BUI:** `BUI` components are Web Components created via `BUI.html` string templates or `BUI.Component.create()`, not React JSX `<BimPanel />`.
- **Calling `components.get()` too early:** Always `await components.init()` before accessing tools.
- **Importing `components-front` on server:** Any tool from `@thatopen/components-front` (like `Highlighter`) will crash if imported during SSR/Node.
- **Forgetting to export:** Not adding the new section to `src/ui-templates/sections/index.ts` will lead to unresolved imports.

## Reference Files
- `references/thatopen-apis.md`: Read when you need to understand `OBC` registry patterns or specific tool integrations (`Highlighter`, `FragmentsManager`).
- `references/bui-patterns.md`: Read when you need to learn how BUI state management, slots, and events work.
- `references/section-template.md`: Read to copy-paste the canonical, fully functioning template based on `models.ts`.
