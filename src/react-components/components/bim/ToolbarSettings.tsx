import { useState, useRef, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";
import { Icon } from "@/react-components/components/ui";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

export function ToolbarSettings() {
  const { components, world } = useBimStore();
  const { showMinimap, setShowMinimap } = useUIStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Viewport Settings States
  const [gridVisible, setGridVisible] = useState(true);
  const [gridLevel, setGridLevel] = useState(0);
  const [projection, setProjection] = useState("Perspective");
  const [hoverHighlight, setHoverHighlight] = useState(true);
  const [hoverColor, setHoverColor] = useState("#6528d7");
  const [autoRotate, setAutoRotate] = useState(false);
  const [hasModel, setHasModel] = useState(false);

  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<{
    isRotating: boolean;
    animationFrameId: number | null;
  }>({
    isRotating: false,
    animationFrameId: null,
  });

  const onUserInteraction = useRef<(() => void) | null>(null);

  // Click outside to close settings dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync settings when components/world are ready or when settings menu is opened
  useEffect(() => {
    if (!components || !world) return;

    const grids = components.get(OBC.Grids);
    const worldGrid = grids.list.get(world.uuid);
    if (worldGrid) {
      setGridVisible(worldGrid.visible);
      setGridLevel(worldGrid.three.position.y);
    }

    const camera = world.camera as any;
    if (camera?.projection) {
      setProjection(camera.projection.current);
    }

    const hoverer = components.get(OBF.Hoverer);
    if (hoverer) {
      setHoverHighlight(hoverer.enabled);
      if ("color" in hoverer.material && hoverer.material.color instanceof THREE.Color) {
        setHoverColor("#" + hoverer.material.color.getHexString());
      }
    }
  }, [components, world, isSettingsOpen]);

  const startRotationLoop = () => {
    if (!autoRotateRef.current.isRotating || !world) return;
    const camera = world.camera as any;
    if (camera?.controls) {
      camera.controls.rotate(0.005, 0, false);
    }
    autoRotateRef.current.animationFrameId = requestAnimationFrame(startRotationLoop);
  };

  const stopRotationLoop = () => {
    if (autoRotateRef.current.animationFrameId !== null) {
      cancelAnimationFrame(autoRotateRef.current.animationFrameId);
      autoRotateRef.current.animationFrameId = null;
    }
  };

  // Define user interaction handler to turn off rotation
  useEffect(() => {
    onUserInteraction.current = () => {
      autoRotateRef.current.isRotating = false;
      setAutoRotate(false);
      stopRotationLoop();
      if (world?.camera) {
        const camera = world.camera as any;
        if (camera.controls && onUserInteraction.current) {
          camera.controls.removeEventListener("controlstart", onUserInteraction.current);
        }
      }
    };
  }, [world]);

  // Sync hasModel status and cleanup rotate listeners
  useEffect(() => {
    if (!components || !world) return;

    const fragments = components.get(OBC.FragmentsManager);

    const updateModelStatus = () => {
      let currentHasModel = false;
      try {
        currentHasModel = fragments.list.size > 0;
      } catch (e) {}
      setHasModel(currentHasModel);

      if (!currentHasModel && autoRotateRef.current.isRotating) {
        autoRotateRef.current.isRotating = false;
        setAutoRotate(false);
        const camera = world.camera as any;
        if (camera?.controls && onUserInteraction.current) {
          camera.controls.removeEventListener("controlstart", onUserInteraction.current);
        }
        stopRotationLoop();
      }
    };

    updateModelStatus();

    let isSubscribed = false;
    const trySubscribe = () => {
      try {
        fragments.list.onItemSet.add(updateModelStatus);
        fragments.list.onItemDeleted.add(updateModelStatus);
        isSubscribed = true;
      } catch (e) {
        setTimeout(trySubscribe, 100);
      }
    };
    trySubscribe();

    return () => {
      if (isSubscribed) {
        try {
          fragments.list.onItemSet.remove(updateModelStatus);
          fragments.list.onItemDeleted.remove(updateModelStatus);
        } catch (e) {}
      }
      if (autoRotateRef.current.isRotating) {
        const camera = world.camera as any;
        if (camera?.controls && onUserInteraction.current) {
          camera.controls.removeEventListener("controlstart", onUserInteraction.current);
        }
        stopRotationLoop();
      }
    };
  }, [components, world]);

  if (!components || !world) return null;

  const handleToggleGrid = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setGridVisible(checked);
    const grids = components.get(OBC.Grids);
    const worldGrid = grids.list.get(world.uuid);
    if (worldGrid) {
      worldGrid.visible = checked;
    }
  };

  const handleGridLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setGridLevel(val);
    const grids = components.get(OBC.Grids);
    const worldGrid = grids.list.get(world.uuid);
    if (worldGrid) {
      worldGrid.three.position.y = val;
    }
  };

  const handleProjectionSelect = async (proj: "Perspective" | "Orthographic") => {
    setProjection(proj);
    const camera = world.camera as any;
    if (camera?.projection) {
      await camera.projection.set(proj);
      camera.updateAspect();
      if (world.renderer && (world.renderer as any).postproduction) {
        (world.renderer as any).postproduction.updateCamera();
      }
    }
  };

  const handleToggleHoverer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHoverHighlight(checked);
    const hoverer = components.get(OBF.Hoverer);
    if (hoverer) {
      hoverer.enabled = checked;
    }
  };

  const handleHoverColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const colorHex = e.target.value;
    setHoverColor(colorHex);
    const hoverer = components.get(OBF.Hoverer);
    if (
      hoverer &&
      "color" in hoverer.material &&
      hoverer.material.color instanceof THREE.Color
    ) {
      hoverer.material.color.set(colorHex);
    }
  };

  const handleToggleAutoRotate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (!hasModel) return;

    autoRotateRef.current.isRotating = checked;
    setAutoRotate(checked);

    const camera = world.camera as any;
    if (!camera?.controls) return;

    if (checked) {
      const boxer = components.get(OBC.BoundingBoxer);
      boxer.list.clear();
      boxer.addFromModels();
      const box = boxer.get();
      boxer.list.clear();
      const center = new THREE.Vector3();
      box.getCenter(center);

      camera.controls.setTarget(center.x, center.y, center.z, true);

      if (onUserInteraction.current) {
        camera.controls.addEventListener("controlstart", onUserInteraction.current);
      }

      startRotationLoop();
    } else {
      if (onUserInteraction.current) {
        camera.controls.removeEventListener("controlstart", onUserInteraction.current);
      }
      stopRotationLoop();
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-white";

  return (
    <div className="relative flex items-center" ref={settingsDropdownRef}>
      <button
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className={buttonClass}
        title="Viewport Settings"
        type="button"
      >
        <Icon name="SETTINGS" size={20} />
      </button>

      {isSettingsOpen && (
        <div className="absolute bottom-full mb-2 right-0 w-[240px] rounded-xl bg-surface border border-border shadow-xl z-50 p-4 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150 flex flex-col gap-3.5">
          {/* Grid Visible */}
          <div className="flex items-center justify-between text-xs text-fg">
            <span className="font-medium text-muted">Grid Visible</span>
            <input
              type="checkbox"
              checked={gridVisible}
              onChange={handleToggleGrid}
              className="w-4.5 h-4.5 rounded border-border text-accent bg-transparent accent-accent cursor-pointer"
            />
          </div>

          {/* Mini Map */}
          <div className="flex items-center justify-between text-xs text-fg">
            <span className="font-medium text-muted">Mini Map</span>
            <input
              type="checkbox"
              checked={showMinimap}
              onChange={(e) => setShowMinimap(e.target.checked)}
              className="w-4.5 h-4.5 rounded border-border text-accent bg-transparent accent-accent cursor-pointer"
            />
          </div>

          {/* Auto Rotate */}
          <div className={`flex items-center justify-between text-xs text-fg ${!hasModel ? "opacity-50 pointer-events-none" : ""}`}>
            <span className="font-medium text-muted">Auto Rotate</span>
            <input
              type="checkbox"
              checked={autoRotate}
              disabled={!hasModel}
              onChange={handleToggleAutoRotate}
              className="w-4.5 h-4.5 rounded border-border text-accent bg-transparent accent-accent cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          {/* Grid Level (m) */}
          <div className="flex items-center justify-between text-xs text-fg">
            <span className="font-medium text-muted">Grid Level (m)</span>
            <input
              type="number"
              step="0.1"
              value={gridLevel}
              onChange={handleGridLevelChange}
              className="w-16 px-2.5 py-1 rounded bg-surface-alt border border-border text-fg text-right text-xs focus:outline-none focus:border-accent"
            />
          </div>

          {/* Camera Projection */}
          <div className="flex items-center justify-between text-xs text-fg">
            <span className="font-medium text-muted">Camera Projection</span>
            <div className="relative flex items-center">
              <select
                value={projection}
                onChange={(e) => handleProjectionSelect(e.target.value as any)}
                className="appearance-none bg-surface-alt border border-border rounded pl-2.5 pr-7 py-1.5 text-xs text-fg cursor-pointer focus:outline-none focus:border-accent font-semibold"
              >
                <option value="Perspective">Perspective</option>
                <option value="Orthographic">Orthographic</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 text-muted flex items-center">
                <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-border/60 my-0.5" />

          {/* Hover Highlight */}
          <div className="flex items-center justify-between text-xs text-fg">
            <span className="font-medium text-muted">Hover Highlight</span>
            <input
              type="checkbox"
              checked={hoverHighlight}
              onChange={handleToggleHoverer}
              className="w-4.5 h-4.5 rounded border-border text-accent bg-transparent accent-accent cursor-pointer"
            />
          </div>

          {/* Hover Color */}
          <div className="flex items-center justify-between text-xs text-fg">
            <span className="font-medium text-muted">Hover Color</span>
            <label className="flex items-center gap-2 bg-surface-alt border border-border px-2 py-1 rounded cursor-pointer hover:border-accent transition-colors">
              <span className="w-3.5 h-3.5 rounded-sm border border-border/40" style={{ backgroundColor: hoverColor }} />
              <span className="text-[11px] font-mono font-semibold text-fg uppercase">{hoverColor}</span>
              <input
                type="color"
                value={hoverColor}
                onChange={handleHoverColorChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
