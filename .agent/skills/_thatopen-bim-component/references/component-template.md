# Canonical Custom Component Template

This is a copy-paste ready reference implementation for a fully compliant custom `OBC.Component`. It demonstrates registry connection, strictly-typed events, internal variables, and proper memory disposal.

```typescript
// src/bim-components/MyCustomTool/index.ts
import * as OBC from "@thatopen/components";
import * as THREE from "three";

export class MyCustomTool extends OBC.Component implements OBC.Disposable {
  /**
   * 1. A unique identifier for the registry.
   */
  static readonly uuid = "e4a3b8c2-1234-abcd-5678-0123456789ab" as const;

  /**
   * 2. Required by OBC.Component
   */
  enabled = true;

  /**
   * 3. Required by OBC.Disposable
   */
  readonly onDisposed = new OBC.Event<string>();

  /**
   * 4. Custom Events
   */
  readonly onDataUpdated = new OBC.Event<number>();

  /**
   * 5. Private fields with underscores
   */
  private _meshes: THREE.Mesh[] = [];
  private _isActive = false;

  constructor(components: OBC.Components) {
    super(components);

    // 6. Register immediately
    components.add(MyCustomTool.uuid, this);

    // 7. Initialize functionality
    this.setupEvents(true);
  }

  /**
   * Your custom logic method
   */
  public toggleFeature(active: boolean) {
    this._isActive = active;
    this.onDataUpdated.trigger(Date.now());
  }

  /**
   * Event binder
   */
  private setupEvents(active: boolean) {
    // Note: use arrow functions for callbacks to preserve 'this'
    if (active) {
      window.addEventListener("keydown", this._onKeyDown);
    } else {
      window.removeEventListener("keydown", this._onKeyDown);
    }
  }

  /**
   * Event callback
   */
  private _onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled || !this._isActive) return;
    if (event.key === "Escape") {
      console.log("Escape pressed inside custom tool!");
    }
  };

  /**
   * 8. Mandatory disposal method for memory management
   */
  dispose() {
    // Unbind DOM events
    this.setupEvents(false);

    // Dispose WebGL Resources
    const disposer = this.components.get(OBC.Disposer);
    for (const mesh of this._meshes) {
      disposer.dispose(mesh);
    }

    // Free JavaScript memory
    this._meshes = [];

    // Trigger disposal events
    this.onDisposed.trigger(MyCustomTool.uuid);
    this.onDisposed.reset();
  }
}
```
