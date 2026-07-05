# Memory Management Rules

BIM applications deal with massive amounts of geometric and tabular data. Strict memory management is non-negotiable. If you create a custom component, you must ensure it cleans up perfectly when destroyed.

## `OBC.Disposable` Interface

Every component should implement `OBC.Disposable`. This forces you to define a `dispose()` method and an `onDisposed` event.

### The Disposer Tool
Three.js requires manual disposal of Geometries, Materials, and Textures. Simply setting a Mesh to `null` will cause a massive GPU memory leak.

Use `OBC.Disposer`:

```typescript
// During disposal...
const disposer = this.components.get(OBC.Disposer);

// Pass any Three.js object, array of objects, or object containing meshes
for (const mesh of this._myMeshes) {
    disposer.dispose(mesh);
}
```

### Freeing JavaScript Memory
After disposing the WebGL resources, you must drop the JavaScript references so the garbage collector can reclaim the RAM.

```typescript
// Good
this._myMeshes = [];
this._customDataMap.clear();

// Bad: Leaves pointers active
// this._myMeshes.forEach(m => disposer.dispose(m)); 
```

### Event Cleanup

If your component binds to `window`, `document`, or global HTML elements, you **must** unbind them.

```typescript
private setupEvents(active: boolean) {
    if (active) {
        window.addEventListener("resize", this.onResize);
    } else {
        window.removeEventListener("resize", this.onResize);
    }
}

// In dispose()
this.setupEvents(false);
```

> **IMPORTANT**: Use arrow functions for callbacks (`private onResize = () => {}`) to preserve `this` context without needing `.bind()`. This makes `removeEventListener` work correctly.

### The Complete `dispose()` Flow

```typescript
dispose() {
    // 1. Unbind global DOM events
    this.setupEvents(false);

    // 2. Dispose Three.js objects
    const disposer = this.components.get(OBC.Disposer);
    for (const mesh of this._meshes) {
        disposer.dispose(mesh);
    }

    // 3. Clear JS arrays/maps
    this._meshes = [];

    // 4. Trigger disposal events
    this.onDisposed.trigger(MyTool.uuid);
    this.onDisposed.reset();
}
```
