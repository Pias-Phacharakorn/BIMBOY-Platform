# Architecture: Custom BIM Components

When you build a new tool for LearnThatOpen (e.g., a GIS tool, a custom data visualizer, or an advanced measuring module), you must hook into the `@thatopen/components` ecosystem. 

## The `OBC.Component` Class

Every major tool in ThatOpen extends `OBC.Component`.

1. **The Registry**: `OBC.Components` acts as a central registry and dependency injector. When you create a tool, you add it to this registry so other tools (and UI elements) can access it globally.
2. **UUIDs**: Every component requires a static unique identifier (`uuid`). This is used to look up the component in the registry.

### Creating the Component

```typescript
import * as OBC from "@thatopen/components";

export class MyTool extends OBC.Component {
    // 1. Define a unique UUID
    static readonly uuid = "generate uuid " as const;

    // 2. Define the enabled flag (required by OBC.Component)
    enabled = true;

    constructor(components: OBC.Components) {
        super(components);

        // 3. Add to registry immediately
        components.add(MyTool.uuid, this);
    }
}
```

## Integrating with the World

Many custom tools need to interact with the 3D scene (Three.js). You can fetch the `Worlds` component to access the active scene, camera, and renderer.

```typescript
const worlds = this.components.get(OBC.Worlds);
// Usually, you'll want the main world:
const world = worlds.list.values().next().value;

if (world) {
    const scene = world.scene.three;
    const camera = world.camera.three;
    // Add custom 3D objects to the scene
}
```

## Why Not React?

Keep BIM logic out of React. By extending `OBC.Component`, your code remains pure Vanilla TypeScript. It can be ported to other frameworks (Vue, Angular) and avoids React render cycle performance hits. The UI templates (BUI) handle the interface, while `OBC.Component` handles the math and 3D data.
