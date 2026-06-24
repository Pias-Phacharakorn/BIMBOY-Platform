---
name: _thatopen-bim-component
description: Comprehensive workflow to design, structure, code, and register custom BIM Components extending OBC.Component in the @thatopen ecosystem. Covers memory management, lifecycle events, UI separation, and strict coding guidelines.
---

# LearnThatOpen — Custom BIM Component Guide

## Invoke This Skill When
- Asked to "add a custom BIM tool", "create a new core component", "build a new GIS tool", or "extend OBC.Component".
- Creating or editing tools under `src/bim-components/`.
- Reviewing memory disposal or lifecycle methods of 3D tools in `@thatopen`.
- Asked to fix memory leaks or crash issues related to BIM model viewing and loading.

---

## 1. Clean Directory & File Layout
Always follow the **PascalCase** naming convention for files and organize them under a modular structure. Keep UI templates/rendering decoupled from component math and data logic.

```
src/bim-components/MyCustomTool/
├── index.ts              # Root entry point: defines the main OBC.Component class
└── src/
    ├── MyCustomToolCore.ts # Core logic or data processing sub-managers
    └── index.ts          # Re-exports all internal classes/types in src/
```

### Export Rules:
- The base file of your component must always be named `index.ts` and reside in the folder matching the component's name.
- Any supporting implementation files must live in a nested `src/` folder.
- `src/index.ts` must re-export all internal classes so that the root `index.ts` can import them using `./src`.

---

## 2. Creating the Component Class

To create a component, extend the base `OBC.Component` class, define a static UUID v4 identifier, and register it in the constructor.

```typescript
import * as OBC from "@thatopen/components";
import { MyCustomToolCore } from "./src";

export class MyCustomTool extends OBC.Component implements OBC.Disposable {
  // 1. Mandatory UUID v4 identifier
  static readonly uuid = "d3c72b21-4f81-4475-b6d8-21d9b3d0a273" as const;

  // 2. Mandatory active status property
  enabled = true;

  // 3. Mandatory disposal event
  readonly onDisposed = new OBC.Event<string>();

  public core: MyCustomToolCore;

  constructor(components: OBC.Components) {
    super(components);
    
    // 4. Register inside the components context
    components.add(MyCustomTool.uuid, this);

    this.core = new MyCustomToolCore();
  }

  dispose() {
    this.enabled = false;
    
    // Clean up memory (see section 4)
    this.onDisposed.trigger(MyCustomTool.uuid);
    this.onDisposed.reset();
  }
}
```

> [!CAUTION]
> The `static readonly uuid` property **must be a valid UUID v4** string. Using a plain string name (like `"my-tool"`) will cause the components registry validation check to fail at runtime.

---

## 3. Strict Coding Guidelines

Follow these TypeScript clean-code rules to maintain project-wide consistency:

1. **Explicit Private Members**: Name all private members with a leading underscore (`_myPrivateField`).
2. **Never Initialize Private Constructor Parameters**: Define fields explicitly at the class level instead of declaring them private inside the constructor parameters.
   ```typescript
   /* ❌ Incorrect */
   constructor(private _components: Components) {}

   /* ✅ Correct */
   private _components: Components;
   constructor(components: Components) {
     super(components);
     this._components = components;
   }
   ```
3. **Avoid Non-Null Assertion (`!`)**: If a field is not initialized in the constructor, declare it with a question mark (`?`) or use a getter to assert that it is defined:
   ```typescript
   private _customProperty?: string;

   get customProperty(): string {
     if (!this._customProperty) {
       throw new Error("Custom property not initialized!");
     }
     return this._customProperty;
   }
   ```
4. **Readonly Events**: Always declare event triggers as `readonly` and initialize them directly:
   ```typescript
   readonly onDataUpdated = new OBC.Event<number>();
   ```
5. **Avoid `any`**: Keep variables strictly typed to prevent runtime errors and ensure reliable autocomplete.

---

## 4. Memory Management & Disposal (WebGL & JS)

Massive geometric models consume significant graphics memory (VRAM) and system RAM. You **must** implement `OBC.Disposable` and implement the `dispose()` method cleanly to prevent memory leaks and browser freezes.

### A. WebGL Resource Disposal (Three.js Meshes)
Three.js does not automatically garbage collect VRAM buffer data (geometries and materials). You must dispose of them using `OBC.Disposer`:
```typescript
dispose() {
  const disposer = this.components.get(OBC.Disposer);
  for (const mesh of this._meshes) {
    disposer.dispose(mesh); // Safely clears materials, geometries, and children
  }
  this._meshes = []; // Clear array references to allow JS garbage collection
}
```

### B. JavaScript Garbage Collection Assist
Assign empty initializers to large data objects or arrays inside `dispose()` to immediately free up pointers:
```typescript
this.dataArray = [];
this.dataObject = {};
this._customDataMap.clear();
```

### C. Event Cleanups
Unbind all global event listeners (e.g., `window`, `document`, or external HTML elements) when the component is destroyed. Always use **arrow functions** for event callbacks so that `removeEventListener` can reference them correctly:
```typescript
private setupEvents(active: boolean) {
  if (active) {
    window.addEventListener("resize", this._onResize);
  } else {
    window.removeEventListener("resize", this._onResize);
  }
}

private _onResize = () => {
  // preserves 'this' context dynamically
  console.log("Resized");
};
```

---

## 5. UI Integration & Reactive State
To bridge the gap between heavy calculations and light BUI (BIM UI) templates:
1. Define event triggers in the component using `OBC.Event`.
2. Subscribe to component events inside BUI templates to trigger reactive rendering changes.
3. Hook into element lifecycles (like `disconnectedCallback`) of BUI panels to clean up event listeners and prevent memory leaks.

```typescript
// Register updates
activeUpdateFunctions.add(myUpdateCallback);

// Deregister on component unmount
const originalDisconnect = (panel as any).disconnectedCallback;
(panel as any).disconnectedCallback = function (this: any) {
  activeUpdateFunctions.delete(myUpdateCallback);
  if (originalDisconnect) {
    originalDisconnect.call(this);
  }
};
```

---

## 6. Registration in `setupComponents`
Register all new components inside `src/bim-components/setup/index.ts` so they are initialized globally:

```typescript
import { MyCustomTool } from "../MyCustomTool";

export const setupComponents = async () => {
  const components = new OBC.Components();
  // ...
  new MyCustomTool(components); // Instantiates and registers itself via components.add()
  // ...
  components.init();
  return { components, viewport };
};
```

---

## 7. Troubleshooting & Common Mistakes

| Issue | Root Cause | Solution |
| --- | --- | --- |
| `Component not found` error | Forgot to call `components.add(uuid, this)` in constructor. | Add registration call to constructor. |
| Crash / Validation failed during startup | UUID is not a valid UUID v4 format (e.g. `"my-tool"`). | Generate a valid UUID v4 string. |
| High RAM/GPU memory usage after page switch | Three.js Meshes were not disposed of, or event listeners were left active. | Use `OBC.Disposer`, empty arrays, and run `removeEventListener`. |
| `this` is undefined inside callback | Used standard function syntax for `addEventListener` callback. | Convert the callback to an arrow function (`private _handler = () => {}`). |
