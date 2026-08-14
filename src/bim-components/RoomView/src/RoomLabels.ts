import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { RoomLabelParts } from "./types";

/**
 * A `CSS2DObject` pool, one chip per visible room.
 *
 * Same mechanism as `CursorZoom`'s `PivotMarker` and the surface-measure pills:
 * `OBF.PostproductionRenderer` extends `RendererWith2D`, which already owns the `CSS2DRenderer`
 * that draws these — so a chip costs no render pass, no material, and no per-frame rescaling.
 *
 * ⚠️ **CSS2D cannot be occluded.** Chips draw *through* geometry, so a pinned room behind the
 * building still shows its name over the front of it. That is consistent with every other 2D
 * overlay in this app, and it is why `RoomView` caps how many can be pinned at once rather than
 * letting the viewport fill with chips.
 */
export class RoomLabels {
  private readonly _objects = new Map<string, CSS2DObject>();

  // `Object3D`, not `Scene`: `OBC.BaseScene.three` is typed as the former, and any parent works.
  private _scene: THREE.Object3D | null = null;

  attach(scene: THREE.Object3D) {
    if (this._scene === scene) return;
    this.detach();
    this._scene = scene;
    for (const object of this._objects.values()) scene.add(object);
  }

  detach() {
    if (!this._scene) return;
    for (const object of this._objects.values()) this._scene.remove(object);
    this._scene = null;
  }

  has(key: string) {
    return this._objects.has(key);
  }

  keys() {
    return [...this._objects.keys()];
  }

  set(key: string, parts: RoomLabelParts, position: THREE.Vector3) {
    let object = this._objects.get(key);
    if (!object) {
      object = new CSS2DObject(chipElement(parts));
      this._objects.set(key, object);
      this._scene?.add(object);
    } else {
      object.element.replaceChildren(...chipSpans(parts));
    }
    object.position.copy(position);
  }

  remove(key: string) {
    const object = this._objects.get(key);
    if (!object) return;
    this._scene?.remove(object);
    // `CSS2DObject` leaves its element in the DOM once its object leaves the scene graph — the
    // same cleanup `PivotMarker.detach` and `surface-measure-cursor._disposeMeasurement` do.
    object.element.remove();
    this._objects.delete(key);
  }

  clear() {
    for (const key of this.keys()) this.remove(key);
  }
}

/**
 * The chip itself. Magenta rather than the app accent because it has to stay legible against a
 * white-ghosted building *and* against the amber room volume it sits on top of.
 */
function chipElement(parts: RoomLabelParts): HTMLDivElement {
  const div = document.createElement("div");
  div.style.cssText = `
    display: flex;
    align-items: baseline;
    gap: 6px;
    background: #a21caf;
    color: #fff;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-family: Inter, system-ui, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    border: 1px solid rgba(0, 0, 0, 0.35);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  `;
  div.replaceChildren(...chipSpans(parts));
  return div;
}

/** Number dimmed, name bold — the same visual split the panel row uses. */
function chipSpans(parts: RoomLabelParts): HTMLSpanElement[] {
  const spans: HTMLSpanElement[] = [];

  if (parts.number) {
    const number = document.createElement("span");
    number.style.cssText = "font-weight: 500; opacity: 0.75;";
    number.textContent = parts.number;
    spans.push(number);
  }

  if (parts.name) {
    const name = document.createElement("span");
    name.style.cssText = "font-weight: 600;";
    name.textContent = parts.name;
    spans.push(name);
  }

  return spans;
}
