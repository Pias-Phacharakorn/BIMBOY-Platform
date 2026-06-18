---
name: learnopen-add-custom-bim-component
description: Teaches how to add a custom, non-standard BIM Component to the @thatopen ecosystem. Use when asked to "add a custom BIM tool", "create a new core component", "build a new GIS tool", or "extend OBC.Component". Covers memory management, lifecycle, and registration.
---

# LearnThatOpen — Add Custom BIM Component

## Invoke This Skill When
- "add a new core BIM component"
- "create a custom tool extending OBC.Component"
- "add a new feature to the 3D viewer (like GIS tools)"
- "create a tool that manages 3D meshes"
- "how do I add a new tool to setup/index.ts"

## Architecture Overview

When adding a core engine feature (not just UI), you must extend `OBC.Component` and implement `OBC.Disposable`. This ensures the tool integrates with the registry and doesn't cause memory leaks.

| File Path | Purpose |
| --- | --- |
| `src/bim-components/<CustomToolName>/index.ts` | The core logic class extending `OBC.Component`. |
| `src/bim-components/setup/index.ts` | Where the tool is instantiated and registered. |

## Step-by-Step Workflow

**Step 1 — Create the Component Folder and Class**
In `src/bim-components/`, create a new folder for your tool (e.g., `MyCustomTool/index.ts`). You must extend `OBC.Component` and implement `OBC.Disposable`.
```typescript
// src/bim-components/MyCustomTool/index.ts
import * as OBC from "@thatopen/components";
import * as THREE from "three";

export class MyCustomTool extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "a-unique-uuid-string-here" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  private _meshes: THREE.Mesh[] = [];

  constructor(components: OBC.Components) {
    super(components);
    components.add(MyCustomTool.uuid, this);
  }

  // Mandatory dispose method for memory management
  dispose() {
    this.setupEvents(false);
    const disposer = this.components.get(OBC.Disposer);
    for (const mesh of this._meshes) {
      disposer.dispose(mesh);
    }
    this._meshes = [];
    this.onDisposed.trigger(MyCustomTool.uuid);
    this.onDisposed.reset();
  }

  private setupEvents(active: boolean) {
      // Toggle window or document event listeners here
  }
}
```

**Step 2 — Implement Logic and Events**
Keep your variables strictly typed (no `any`), use underscores for private fields (`_myField`), and initialize `readonly OBC.Event` instances for component communication. Ensure all external event listeners (like `window.addEventListener`) are cleaned up in `dispose()`.

**Step 3 — Register the Component**
Open `src/bim-components/setup/index.ts`. Inside `setupComponents()`, initialize your new component.
```typescript
import { MyCustomTool } from "../MyCustomTool";

export const setupComponents = async () => {
    const components = new OBC.Components();
    // ...
    const myCustomTool = new MyCustomTool(components);
    // ...
    components.init();
    return { components, viewport };
};
```

**Step 4 — (Optional) Connect to UI**
If the tool requires UI, create a BUI template in `src/ui-templates/` and retrieve your tool using `components.get(MyCustomTool)`.

## Common Mistakes
- **Forgetting `components.add()`**: If you don't register the instance in the constructor, `components.get()` will fail later.
- **Memory Leaks**: Forgetting to call `disposer.dispose()` on Three.js objects or forgetting to clear arrays (`this._meshes = []`).
- **Dangling Event Listeners**: Binding to `window` and not removing the listener in `dispose()`.
- **Mixing React and Logic**: Putting Three.js or heavy data logic inside React instead of a vanilla TS `OBC.Component`.

## Reference Files
- `references/architecture.md`: Read for deep details on how `OBC.Component` integrates with the `@thatopen` ecosystem.
- `references/memory-management.md`: Read to understand strict disposal rules, Three.js cleanup, and event unbinding.
- `references/component-template.md`: Read to copy-paste a fully compliant, heavily commented template class.
