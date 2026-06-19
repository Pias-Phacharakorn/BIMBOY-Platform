import { useEffect, useRef } from "react";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { setupComponents } from "../../bim-components";
import { useBimStore } from "../store/bimStore";

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

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    let viewportElement: any = null;
    let activeComponents: any = null;

    setupComponents().then(({ components, viewport }) => {
      if (isCancelled) {
        components.dispose();
        return;
      }
      activeComponents = components;

      // Extract active world
      const worlds = components.get(OBC.Worlds);
      const world = worlds.list.values().next().value || null;

      // Sync active state to Zustand store
      useBimStore.getState().setBimData(components, world, viewport);

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
      if (viewportElement) {
        viewportElement.remove();
      }
      if (activeComponents) {
        activeComponents.dispose();
      }
    };
  }, [gridTemplate, onSetup]);

  return (
    <div
      ref={containerRef}
      className="viewport-container model-viewport"
      style={{ width: "100%", height: "100%" }}
      aria-label="BIM model viewport container"
    >
      <div className="app-container" style={{ padding: "40px" }}>
        Loading BIM Viewer...
      </div>
    </div>
  );
}
