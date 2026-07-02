// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";

export class SpotLabelManager {
  public readonly onLabelsChanged = new OBC.Event<void>();

  private _spotLabels: {
    id: string;
    element: HTMLDivElement;
    point: THREE.Vector3;
    displayPoint: THREE.Vector3;
  }[] = [];

  public get labels() {
    return this._spotLabels;
  }

  public clearSpotLabels() {
    for (const label of this._spotLabels) {
      label.element.remove();
    }
    this._spotLabels = [];
    this.onLabelsChanged.trigger();
  }

  public deleteLabel(id: string) {
    const idx = this._spotLabels.findIndex((item) => item.id === id);
    if (idx === -1) return;
    this._spotLabels[idx].element.remove();
    this._spotLabels.splice(idx, 1);
    this.onLabelsChanged.trigger();
  }

  public updateLabelPositions(world: OBC.World) {
    if (this._spotLabels.length === 0) return;
    const viewport = world.renderer!.three.domElement;
    const rect = viewport.getBoundingClientRect();
    const camera = world.camera.three;

    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    const tempV = new THREE.Vector3();

    for (const item of this._spotLabels) {
      const { element, point } = item;
      const toPoint = tempV.copy(point).sub(cameraPosition);
      const isBehind = toPoint.dot(cameraDirection) < 0;

      if (isBehind) {
        element.style.display = "none";
      } else {
        element.style.display = "block";
        tempV.copy(point).project(camera);
        const x = (tempV.x * 0.5 + 0.5) * rect.width;
        const y = (-tempV.y * 0.5 + 0.5) * rect.height;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      }
    }
  }

  public async handleSpotClick(
    e: MouseEvent,
    world: OBC.World,
    components: OBC.Components
  ) {
    const raycasters = components.get(OBC.Raycasters);
    const raycaster = raycasters.get(world);
    const result = await raycaster.castRay();
    if (!result || !result.point) return;

    const displayPoint = result.point.clone();
    let model: any = null;
    const mesh = result.object as any;
    if (mesh && mesh.fragment && mesh.fragment.group) {
      model = mesh.fragment.group;
    }
    
    if (model && typeof model.getCoordinationMatrix === "function") {
      try {
        const matrix = await model.getCoordinationMatrix();

        // ── Coordinate system facts (verified from ThatOpen source) ─────────────
        // • result.point  →  Three.js world space (Y-up, right-handed)
        //   ThatOpen applies makeRotationX(-PI/2) to all geometry on load,
        //   rotating IFC Z-up geometry into Three.js Y-up space.
        //
        // • getCoordinationMatrix() returns a matrix built from raw IFC data:
        //   the IFC project origin (x,y,z) and IFC xDir/yDir vectors.
        //   These are in IFC Z-up space — NO PI/2 rotation is baked in.
        //
        // • Navisworks displays coordinates in IFC project space (Z-up).
        //
        // ── Conversion pipeline ──────────────────────────────────────────────────
        // Step 1: Convert result.point from Three.js Y-up → IFC Z-up (swizzle):
        //   IFC.x =  THREE.x
        //   IFC.y = -THREE.z   (Three.js -Z = IFC Y-north)
        //   IFC.z =  THREE.y   (Three.js Y-up = IFC Z-up)
        //
        // Step 2: Apply inverse coordination matrix to get IFC project coords.
        //   (coordination matrix maps IFC local → IFC project space)
        // ─────────────────────────────────────────────────────────────────────────

        // Step 1: swizzle Three.js Y-up → IFC Z-up
        const ifcZUp = new THREE.Vector3(
          result.point.x,
          -result.point.z,
          result.point.y,
        );

        // Step 2: apply coordination matrix to add back the IFC site origin
        // (COORDINATE_TO_ORIGIN subtracts the origin during load; we re-add it)
        ifcZUp.applyMatrix4(matrix);

        // ifcZUp is now in IFC project coordinates (Z-up), matching Navisworks
        displayPoint.copy(ifcZUp);
      } catch (err) {
        console.warn("Failed to get coordination matrix", err);
        // Fallback: plain Three.js → IFC Z-up swizzle (no project offset)
        displayPoint.set(result.point.x, -result.point.z, result.point.y);
      }
    } else {
      // No coordination matrix: just swizzle Three.js Y-up → IFC/Navisworks Z-up
      displayPoint.set(result.point.x, -result.point.z, result.point.y);
    }

    const { x, y, z } = displayPoint;

    const label = document.createElement("div");
    label.style.cssText = `
      position: absolute;
      background: oklch(22% 0.06 255 / 0.95);
      border: 1px solid oklch(55% 0.18 255);
      color: #e8f0ff;
      padding: 7px 11px;
      border-radius: 7px;
      font-size: 11.5px;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      z-index: 150;
      line-height: 1.7;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px oklch(40% 0.12 255 / 0.3);
      white-space: nowrap;
      backdrop-filter: blur(4px);
      transform: translate(-50%, -100%) translateY(-20px);
      pointer-events: none;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      font-size: 10px;
      color: oklch(65% 0.18 255);
      margin-bottom: 3px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    `;
    header.textContent = "Coordinate";
    label.appendChild(header);

    const rows = [
      { axis: "X", val: x, color: "oklch(72% 0.22 25)" },
      { axis: "Y", val: y, color: "oklch(75% 0.22 145)" },
      { axis: "Z", val: z, color: "oklch(72% 0.22 255)" },
    ];
    for (const { axis, val, color } of rows) {
      const row = document.createElement("div");
      row.style.cssText = `display: flex; gap: 6px; align-items: baseline;`;
      row.innerHTML = `<span style="color:${color};font-weight:700;width:10px">${axis}</span><span style="color:#ccd9ff">${val.toFixed(3)} m</span>`;
      label.appendChild(row);
    }

    const close = document.createElement("span");
    close.textContent = "✕";
    close.style.cssText = `
      position: absolute;
      top: 3px; right: 5px;
      font-size: 9px;
      color: oklch(55% 0.1 255);
      cursor: pointer;
      pointer-events: auto;
      line-height: 1;
    `;
    close.addEventListener("click", (ev) => {
      ev.stopPropagation();
      label.remove();
      const idx = this._spotLabels.findIndex(item => item.element === label);
      if (idx !== -1) {
        this._spotLabels.splice(idx, 1);
      }
      this.onLabelsChanged.trigger();
    });
    label.appendChild(close);

    const viewport = world.renderer!.three.domElement;
    if (viewport.parentElement) {
      viewport.parentElement.appendChild(label);
    }

    const id = THREE.MathUtils.generateUUID();
    this._spotLabels.push({ id, element: label, point: result.point, displayPoint: displayPoint.clone() });
    this.updateLabelPositions(world);
    this.onLabelsChanged.trigger();
  }
}

