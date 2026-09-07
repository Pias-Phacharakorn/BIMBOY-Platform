import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { ChipEntry } from "./types";

/**
 * A `CSS2DObject` pool, one chip per visible device.
 *
 * Same mechanism as `RoomLabels`: `OBF.PostproductionRenderer` extends `RendererWith2D`, which
 * already owns the `CSS2DRenderer` that draws these — so a chip costs no render pass and no
 * per-frame rescaling.
 *
 * ⚠️ **CSS2D cannot be occluded.** Chips draw *through* geometry, so a device behind the building
 * still labels the front of it. That is why `IotView` caps how many exist at once, and why the
 * cap is ordered by status rather than by list position.
 *
 * **Styling lives in `style.css`, not here.** Unlike `RoomLabels`, which sets `cssText` with
 * hardcoded hex, these chips carry class names only. A runtime probe confirmed the 2D layer is a
 * light-DOM child of `<bim-viewport>` (`inShadow: false`), so a document stylesheet reaches it and
 * the design tokens resolve — which keeps every colour in the design system rather than in engine
 * code. Tailwind is not an option here: the project's layer rules make `bim-components/`
 * engine-only.
 */
export class IotChips {
  private readonly _objects = new Map<string, CSS2DObject>();

  // `Object3D`, not `Scene`: `OBC.BaseScene.three` is typed as the former, and any parent works.
  private _scene: THREE.Object3D | null = null;

  /**
   * Whether chips currently accept clicks.
   *
   * ⚠️ Held as state, not just applied to the elements that happen to exist when it changes.
   * `_applyEntry` reassigns `className` wholesale on every sync — which runs on every telemetry
   * tick — so a class toggled from outside would be wiped within seconds, silently re-arming the
   * click interception that this flag exists to prevent while a viewport tool is placing points.
   */
  private _interactive = true;

  /** Notified with the device id when a chip is clicked. Set by the owning component. */
  onClick: ((deviceId: string) => void) | null = null;

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

  keys() {
    return [...this._objects.keys()];
  }

  set(entry: ChipEntry, position: THREE.Vector3) {
    let object = this._objects.get(entry.deviceId);
    if (!object) {
      object = new CSS2DObject(this._createElement(entry));
      this._objects.set(entry.deviceId, object);
      this._scene?.add(object);
    } else {
      this._applyEntry(object.element as HTMLDivElement, entry);
    }
    object.position.copy(position);
  }

  remove(deviceId: string) {
    const object = this._objects.get(deviceId);
    if (!object) return;
    this._scene?.remove(object);
    // `CSS2DObject` leaves its element in the DOM once its object leaves the scene graph — the
    // same cleanup `RoomLabels.remove` and `PivotMarker.detach` do.
    object.element.remove();
    this._objects.delete(deviceId);
  }

  clear() {
    for (const key of this.keys()) this.remove(key);
  }

  /**
   * Whether chips accept clicks.
   *
   * The 2D layer is `pointer-events: none` as a whole, so each chip opts itself back in. Turning
   * this off is what keeps chips from stealing clicks meant for geometry while a viewport tool is
   * placing points or planes.
   */
  setInteractive(interactive: boolean) {
    if (this._interactive === interactive) return;
    this._interactive = interactive;
    for (const object of this._objects.values()) {
      (object.element as HTMLElement).classList.toggle("iot-chip--inert", !interactive);
    }
  }

  private _createElement(entry: ChipEntry): HTMLDivElement {
    const div = document.createElement("div");
    div.addEventListener("click", (event) => {
      // The canvas sits beneath: without this the same click also picks whatever geometry is
      // behind the chip, so selecting a device would silently change the element selection too.
      event.stopPropagation();
      this.onClick?.(entry.deviceId);
    });
    this._applyEntry(div, entry);
    return div;
  }

  private _applyEntry(div: HTMLDivElement, entry: ChipEntry) {
    // `_interactive` is folded in here rather than toggled separately, so a chip created while a
    // tool is active starts inert and an existing one is not silently re-armed by the next sync.
    div.className = [
      "iot-chip",
      `iot-chip--${entry.tone}`,
      entry.selected ? "iot-chip--selected" : "",
      this._interactive ? "" : "iot-chip--inert",
    ]
      .filter(Boolean)
      .join(" ");
    div.dataset.deviceId = entry.deviceId;
    div.dataset.tone = entry.tone;
    div.replaceChildren(...chipParts(entry));
  }
}

function chipParts(entry: ChipEntry): HTMLElement[] {
  const parts: HTMLElement[] = [];

  const icon = document.createElement("iconify-icon");
  icon.setAttribute("icon", entry.icon);
  icon.setAttribute("width", "13");
  icon.setAttribute("height", "13");
  icon.className = "iot-chip__icon";
  parts.push(icon);

  const value = document.createElement("span");
  value.className = "iot-chip__value";
  // An offline device reports nothing, so the chip says so explicitly. Never a zero — a dead
  // sensor rendered as a perfect reading actively misinforms.
  value.textContent = entry.value || "--";
  parts.push(value);

  if (entry.value && entry.unit) {
    const unit = document.createElement("span");
    unit.className = "iot-chip__unit";
    unit.textContent = entry.unit;
    parts.push(unit);
  }

  if (entry.selected && entry.secondary) {
    const divider = document.createElement("span");
    divider.className = "iot-chip__divider";
    parts.push(divider);

    const secondary = document.createElement("span");
    secondary.className = "iot-chip__secondary";
    secondary.textContent = entry.secondary;
    parts.push(secondary);
  }

  // Status carried by a glyph as well as colour. Measuring this project's status tokens against
  // the dark surface put healthy↔warning at a colour-blind separation below the usable floor, so
  // colour alone cannot be the signal — the same finding that put a word on the status badge.
  if (entry.tone === "warn" || entry.tone === "alarm") {
    const flag = document.createElement("span");
    flag.className = "iot-chip__flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = "⚠";
    parts.push(flag);
  }

  return parts;
}
