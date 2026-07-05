import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { setupComponents, CursorSurface } from "@/bim-components";
import { setupViewCube } from "@/bim-components/setup/src/view-cube";
import { useBimStore } from "@/react-components/store/bimStore";
import { MiniMapOverlay } from "./MiniMapOverlay";

interface ViewportWrapperProps {
  gridTemplate?: BUI.StatefullComponent<any>;
  activeTab?: string;
  onTabsLoaded?: (tabs: string[]) => void;
  onSetup?: (components: OBC.Components, viewport: BUI.Viewport) => void;
}

export function ViewportWrapper({
  gridTemplate,
  activeTab,
  onTabsLoaded,
  onSetup,
}: ViewportWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);

  // Sync active tab to grid layout
  useEffect(() => {
    if (gridRef.current && activeTab) {
      gridRef.current.layout = activeTab;
    }
  }, [activeTab]);

  // View alignment interaction handler
  const {
    aligningDirection,
    setAligningDirection,
    setAlignAngle,
    components,
    world,
  } = useBimStore();

  useEffect(() => {
    if (!components || !world || !aligningDirection) return;

    const viewportDom = world.renderer?.three.domElement;
    if (!viewportDom) return;

    const cursorSurface = components.get(CursorSurface);
    cursorSurface.setWorld(world);

    let raycastInProgress = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (raycastInProgress) return;
      raycastInProgress = true;

      const raycasters = components.get(OBC.Raycasters);
      const raycaster = raycasters.get(world);
      raycaster
        .castRay()
        .then((result) => {
          if (
            result &&
            result.point &&
            ((result as any).normal || (result.face && result.object))
          ) {
            const worldNormal = (result as any).normal
              ? (result as any).normal.clone()
              : result.face!.normal
                  .clone()
                  .transformDirection(result.object.matrixWorld)
                  .normalize();

            cursorSurface.update(result.point, worldNormal);
          } else {
            cursorSurface.hide();
          }
        })
        .catch(() => {
          cursorSurface.hide();
        })
        .finally(() => {
          raycastInProgress = false;
        });
    };

    const handleClick = async (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const raycasters = components.get(OBC.Raycasters);
      const raycaster = raycasters.get(world);
      try {
        const result = await raycaster.castRay();
        if (
          result &&
          result.point &&
          ((result as any).normal || (result.face && result.object))
        ) {
          const worldNormal = (result as any).normal
            ? (result as any).normal.clone()
            : result.face!.normal
                .clone()
                .transformDirection(result.object.matrixWorld)
                .normalize();

          // Horizontal alignment needs a non-vertical normal
          if (Math.abs(worldNormal.y) < 0.99) {
            const N_horiz = new THREE.Vector3(
              worldNormal.x,
              0,
              worldNormal.z
            ).normalize();
            const theta = Math.atan2(N_horiz.x, N_horiz.z);

            let targetAngle = theta;
            if (aligningDirection === "back") {
              targetAngle = theta + Math.PI;
            } else if (aligningDirection === "left") {
              targetAngle = theta - Math.PI / 2;
            } else if (aligningDirection === "right") {
              targetAngle = theta + Math.PI / 2;
            }

            // Normalize targetAngle to [-PI, PI]
            targetAngle = Math.atan2(
              Math.sin(targetAngle),
              Math.cos(targetAngle)
            );

            setAlignAngle(targetAngle);
            setAligningDirection(null);
            cursorSurface.hide();

            // Trigger ViewCube update dynamically by simulating camera control update event
            const camera = world.camera as any;
            if (camera?.controls) {
              camera.controls.dispatchEvent({ type: "update" });
            }
          } else {
            alert(
              "Please select a vertical wall or vertical face to align horizontal directions."
            );
          }
        }
      } catch (err) {
        console.error("Alignment raycasting failed:", err);
      }
    };

    viewportDom.addEventListener("mousemove", handleMouseMove);
    viewportDom.addEventListener("click", handleClick, true);

    return () => {
      viewportDom.removeEventListener("mousemove", handleMouseMove);
      viewportDom.removeEventListener("click", handleClick, true);
      cursorSurface.hide();
    };
  }, [components, world, aligningDirection]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    let viewportElement: any = null;
    let activeComponents: any = null;
    let onHighlightCallback: any = null;
    let onClearCallback: any = null;
    let cleanupViewCube: (() => void) | null = null;

    setupComponents().then(({ components, viewport }) => {
      if (isCancelled) {
        components.dispose();
        return;
      }
      activeComponents = components;

      // Extract active world
      const worlds = components.get(OBC.Worlds);
      const world = worlds.list.values().next().value || null;

      if (world) {
        cleanupViewCube = setupViewCube(world, viewport, components);
      }

      // Sync active state to Zustand store
      useBimStore.getState().setBimData(components, world, viewport);

      // Subscribe to selection events
      const highlighter = components.get(OBF.Highlighter);
      
      const syncSelection = () => {
        const selectMap = highlighter.selection.select;
        const clonedMap: OBC.ModelIdMap = {};
        const selectedIds: number[] = [];
        for (const modelId in selectMap) {
          const expressIds = selectMap[modelId];
          clonedMap[modelId] = new Set(expressIds);
          selectedIds.push(...expressIds);
        }
        useBimStore.getState().setSelectedElements(selectedIds, clonedMap);
      };

      onHighlightCallback = syncSelection;
      onClearCallback = syncSelection;

      highlighter.events.select.onHighlight.add(onHighlightCallback);
      highlighter.events.select.onClear.add(onClearCallback);

      // Execute custom setups if provided
      if (onSetup) {
        onSetup(components, viewport);
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";

        if (gridTemplate) {
          const [grid] = BUI.Component.create<any, any>(
            gridTemplate,
            { components, viewport }
          );

          gridRef.current = grid;

          // Extract and notify parent of available layouts/tabs
          const layoutNames = Object.keys(grid.layouts || {});
          if (layoutNames.length > 0) {
            if (onTabsLoaded) {
              onTabsLoaded(layoutNames);
            }
            if (activeTab) {
              grid.layout = activeTab;
            } else {
              grid.layout = layoutNames[0];
            }
          }

          viewportElement = grid;
          containerRef.current.appendChild(grid);
        } else {
          viewportElement = viewport;
          containerRef.current.appendChild(viewport);
        }
      }
    });

    return () => {
      isCancelled = true;
      useBimStore.getState().clearBimData();
      
      if (cleanupViewCube) {
        cleanupViewCube();
      }
      
      if (activeComponents) {
        try {
          const highlighter = activeComponents.get(OBF.Highlighter);
          if (onHighlightCallback) {
            highlighter.events.select.onHighlight.remove(onHighlightCallback);
          }
          if (onClearCallback) {
            highlighter.events.select.onClear.remove(onClearCallback);
          }
        } catch (e) {
          // Ignore error if highlighter is disposed
        }
        try {
          activeComponents.dispose();
        } catch (e) {
          // Disposing the OBC engine on unmount can throw if a component touches
          // already-torn-down world state (e.g. the `world.camera` getter throws
          // once the camera is gone). Swallow it so React's error boundary doesn't
          // tear down the whole app — the viewport is being removed anyway.
          // Root-cause guards belong in each component's dispose()/_deactivate().
          console.warn("BIM engine dispose error on unmount (non-fatal):", e);
        }
      }

      if (viewportElement) {
        viewportElement.remove();
      }
    };
  }, [gridTemplate, onSetup]);

  return (
    <div
      className="viewport-container model-viewport"
      style={{ width: "100%", height: "100%", position: "relative" }}
      aria-label="BIM model viewport container"
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
      >
        <div className="app-container" style={{ padding: "40px" }}>
          Loading BIM Viewer...
        </div>
      </div>
      <MiniMapOverlay />
    </div>
  );
}
