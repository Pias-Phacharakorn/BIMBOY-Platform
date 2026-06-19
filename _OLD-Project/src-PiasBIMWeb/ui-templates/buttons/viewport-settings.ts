import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { appIcons } from "../../globals";

export interface ViewportSettingsState {
  components: OBC.Components;
  world: OBC.SimpleWorld<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBF.PostproductionRenderer
  >;
}

interface AutoRotateState {
  isRotating: boolean;
  animationFrameId: number | null;
}

const autoRotateStates = new Map<string, AutoRotateState>();

const getAutoRotateState = (worldId: string): AutoRotateState => {
  if (!autoRotateStates.has(worldId)) {
    autoRotateStates.set(worldId, {
      isRotating: false,
      animationFrameId: null,
    });
  }
  return autoRotateStates.get(worldId)!;
};

export const viewportSettingsTemplate: BUI.StatefullComponent<
  ViewportSettingsState
> = (state, update) => {
  const { components, world } = state;

  const grids = components.get(OBC.Grids);
  const worldGrid = grids.list.get(world.uuid);
  const fragments = components.get(OBC.FragmentsManager);
  let hasModel = false;
  try {
    hasModel = fragments.list.size > 0;
  } catch (e) {
    // FragmentsManager is not initialized yet
  }
  const rotateState = getAutoRotateState(world.uuid);

  const startRotationLoop = () => {
    if (!rotateState.isRotating) return;
    world.camera.controls.rotate(0.00125, 0, false);
    rotateState.animationFrameId = requestAnimationFrame(startRotationLoop);
  };

  const stopRotationLoop = () => {
    if (rotateState.animationFrameId !== null) {
      cancelAnimationFrame(rotateState.animationFrameId);
      rotateState.animationFrameId = null;
    }
  };

  let checkboxRef: BUI.Checkbox | null = null;
  const onCheckboxCreated = (el?: Element) => {
    if (el) checkboxRef = el as BUI.Checkbox;
  };

  const onUserInteraction = () => {
    rotateState.isRotating = false;
    stopRotationLoop();
    world.camera.controls.removeEventListener("controlstart", onUserInteraction);
    if (checkboxRef) {
      checkboxRef.checked = false;
    }
    if (update) update();
  };

  const onToggleAutoRotate = ({ target }: { target: BUI.Checkbox }) => {
    rotateState.isRotating = target.checked;

    if (rotateState.isRotating) {
      // Get the center of the loaded models
      const boxer = components.get(OBC.BoundingBoxer);
      boxer.list.clear();
      boxer.addFromModels();
      const box = boxer.get();
      boxer.list.clear();
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Smoothly transition camera target to model center
      world.camera.controls.setTarget(center.x, center.y, center.z, true);

      // Register listener to turn off on manual interaction start
      world.camera.controls.addEventListener("controlstart", onUserInteraction);

      startRotationLoop();
    } else {
      // Clean up event listener and stop loop
      world.camera.controls.removeEventListener("controlstart", onUserInteraction);
      stopRotationLoop();
    }

    target.checked = rotateState.isRotating;
  };

  const updateComponent = () => {
    let currentHasModel = false;
    try {
      currentHasModel = fragments.list.size > 0;
    } catch (e) {
      // not initialized yet
    }
    if (!currentHasModel && rotateState.isRotating) {
      rotateState.isRotating = false;
      world.camera.controls.removeEventListener("controlstart", onUserInteraction);
      stopRotationLoop();
      if (checkboxRef) {
        checkboxRef.checked = false;
      }
    }
    if (update) update();
  };

  const onCreated = (el?: Element) => {
    if (!el) return;

    let isSubscribed = false;
    const trySubscribe = () => {
      try {
        fragments.list.onItemSet.add(updateComponent);
        fragments.list.onItemDeleted.add(updateComponent);
        isSubscribed = true;
      } catch (e) {
        setTimeout(trySubscribe, 100);
      }
    };
    trySubscribe();

    const btn = el as any;
    const originalDisconnect = btn.disconnectedCallback;
    btn.disconnectedCallback = function (this: any) {
      if (isSubscribed) {
        try {
          fragments.list.onItemSet.delete(updateComponent);
          fragments.list.onItemDeleted.delete(updateComponent);
        } catch (e) {}
      }
      if (rotateState.isRotating) {
        world.camera.controls.removeEventListener("controlstart", onUserInteraction);
        stopRotationLoop();
      }
      if (originalDisconnect) {
        originalDisconnect.call(this);
      }
    };
  };

  let worldEnableCheckbox: BUI.TemplateResult | undefined;
  if (worldGrid) {
    const onToggleGrid = ({ target }: { target: BUI.Checkbox }) => {
      worldGrid.visible = target.checked;
      target.checked = worldGrid.visible;
    };

    worldEnableCheckbox = BUI.html`
      <bim-checkbox style="width: 15rem;" ?checked=${worldGrid.visible} label="Grid Visible" @change=${onToggleGrid}></bim-checkbox>
    `;
  }

  const autoRotateCheckbox = BUI.html`
    <bim-checkbox ${BUI.ref(onCheckboxCreated)} style="width: 15rem;" ?checked=${rotateState.isRotating} ?disabled=${!hasModel} label="Auto Rotate" @change=${onToggleAutoRotate}></bim-checkbox>
  `;

  let worldGridLevelInput: BUI.TemplateResult | undefined;
  if (worldGrid) {
    const onGridLevelChange = ({ target }: { target: BUI.NumberInput }) => {
      worldGrid.three.position.y = Number(target.value);
    };

    worldGridLevelInput = BUI.html`
      <bim-number-input 
        style="width: 15rem;" 
        label="Grid Level (m)" 
        value="${worldGrid.three.position.y}" 
        step="0.1" 
        @change=${onGridLevelChange}>
      </bim-number-input>
    `;
  }

  const onProjectionChange = async ({ target }: { target: BUI.Dropdown }) => {
    const [projection] = target.value;
    if (!projection) return;
    await world.camera.projection.set(projection);
    world.camera.updateAspect();
    world.renderer.postproduction.updateCamera();
  };

  const hoverer = components.get(OBF.Hoverer);
  const hoverColorHex = (hoverer.material as any).color ? "#" + (hoverer.material as any).color.getHexString() : "#6528d7";

  const onToggleHoverer = ({ target }: { target: BUI.Checkbox }) => {
    hoverer.enabled = target.checked;
    target.checked = hoverer.enabled;
    if (update) update();
  };

  const onHoverColorChange = ({ target }: { target: BUI.ColorInput }) => {
    if (
      "color" in hoverer.material &&
      hoverer.material.color instanceof THREE.Color
    ) {
      hoverer.material.color.set(target.color);
    }
  };

  return BUI.html`
    <bim-button ${BUI.ref(onCreated)} style="position: absolute; top: 0.5rem; right: 0.5rem; background-color: transparent;" icon=${appIcons.SETTINGS}>
      <bim-context-menu style="width: 16rem; gap: 0.25rem">
        ${worldEnableCheckbox}
        ${autoRotateCheckbox}
        ${worldGridLevelInput}
        <bim-dropdown label="Camera Projection" @change=${onProjectionChange}>
          <bim-option label="Perspective" ?checked=${world.camera.projection.current === "Perspective"}></bim-option> 
          <bim-option label="Orthographic" ?checked=${world.camera.projection.current === "Orthographic"}></bim-option> 
        </bim-dropdown>
        <div style="border-top: 1px solid var(--border); margin: 0.25rem 0;"></div>
        <bim-checkbox style="width: 15rem;" ?checked=${hoverer.enabled} label="Hover Highlight" @change=${onToggleHoverer}></bim-checkbox>
        <bim-color-input color="${hoverColorHex}" label="Hover Color" @input=${onHoverColorChange}></bim-color-input>
      </bim-context-menu> 
    </bim-button>
  `;
};
