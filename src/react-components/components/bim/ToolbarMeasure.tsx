import { useState, useEffect, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { PiasClipper } from "@/bim-components/setup/src/clipper";
import { CursurSurface } from "@/bim-components/CursurSurface";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

export function ToolbarMeasure() {
  const { components, world, activeTool, setActiveTool } = useBimStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeType, setActiveType] = useState<"length" | "angle" | "area" | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState<any | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addedMeshes = useRef<THREE.Mesh[]>([]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync activeType with activeTool
  useEffect(() => {
    if (activeTool !== "measure") {
      setActiveType(null);
    }
  }, [activeTool]);

  // Sync measurements list in React state
  useEffect(() => {
    if (!components || !world) return;

    const measurer = components.get(OBF.LengthMeasurement);

    const syncLines = () => {
      setLines([...measurer.list]);
      const selected = [...measurer.list].find((line) => line.isSelected) || null;
      setSelectedLine(selected);
    };

    // Initial sync
    syncLines();

    measurer.list.onItemAdded.add(syncLines);
    measurer.list.onItemDeleted.add(syncLines);

    return () => {
      measurer.list.onItemAdded.remove(syncLines);
      measurer.list.onItemDeleted.remove(syncLines);
    };
  }, [components, world, isDropdownOpen]);

  // Handle Length Measurement execution, cursor surface, picking modes, listeners and cleanup
  useEffect(() => {
    if (!components || !world || activeTool !== "measure" || activeType !== "length") {
      return;
    }

    const measurer = components.get(OBF.LengthMeasurement);
    const cursurSurface = components.get(CursurSurface);
    const canvas = world.renderer?.three?.domElement;

    // 1. Enable and configure measurer
    measurer.world = world;
    measurer.enabled = true;
    cursurSurface.setWorld(world);

    // 2. Setup Synchronous Picking meshes
    const makeSynchronous = async () => {
      const fragments = components.get(OBC.FragmentsManager);
      measurer.pickerMode = OBF.GraphicVertexPickerMode.SYNCHRONOUS;
      measurer.delay = 0;

      const meshesList: THREE.Mesh[] = [];
      for (const [, model] of fragments.list) {
        try {
          const idsWithGeometry = await model.getItemsIdsWithGeometry();
          const allMeshesData = await model.getItemsGeometry(idsWithGeometry);
          const geometries = new Map<number, THREE.BufferGeometry>();

          for (const itemId in allMeshesData) {
            const meshData = allMeshesData[itemId];
            for (const geomData of meshData) {
              if (
                !geomData.positions ||
                !geomData.indices ||
                !geomData.transform ||
                !geomData.representationId
              ) {
                continue;
              }

              const representationId = geomData.representationId;
              if (!geometries.has(representationId)) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute(
                  "position",
                  new THREE.Float32BufferAttribute(geomData.positions, 3),
                );
                geometry.setIndex(Array.from(geomData.indices));
                geometries.set(representationId, geometry);
              }

              const geometry = geometries.get(representationId)!;
              const mesh = new THREE.Mesh(geometry);
              mesh.applyMatrix4(geomData.transform);
              mesh.applyMatrix4(model.object.matrixWorld);
              mesh.updateWorldMatrix(true, true);
              meshesList.push(mesh);
            }
          }
        } catch (err) {
          console.error("Failed to collect picking meshes:", err);
        }
      }

      addedMeshes.current = meshesList;
      for (const mesh of meshesList) {
        world.meshes.add(mesh);
      }
    };

    makeSynchronous();

    // 3. Rectangular dimension auto-display on complete
    const handleItemAdded = (line: any) => {
      try {
        line.displayRectangularDimensions();
      } catch (err) {
        console.error("Failed to display rectangular dimensions:", err);
      }
    };
    measurer.list.onItemAdded.add(handleItemAdded);

    // 4. Cursor Surface Hover raycast
    let raycastInProgress = false;
    const handleMouseMove = () => {
      if (!raycastInProgress) {
        raycastInProgress = true;
        const raycasters = components.get(OBC.Raycasters);
        const raycaster = raycasters.get(world);

        raycaster.castRay().then((result) => {
          if (result && result.point && ((result as any).normal || (result.face && result.object))) {
            const worldNormal = (result as any).normal 
              ? (result as any).normal.clone() 
              : result.face!.normal.clone().transformDirection(result.object.matrixWorld).normalize();
            cursurSurface.update(result.point, worldNormal);
          } else {
            cursurSurface.hide();
          }
        }).catch(() => {
          cursurSurface.hide();
        }).finally(() => {
          raycastInProgress = false;
        });
      }
    };

    // 5. Single-click pointer listener to avoid camera drag clashes
    let startX = 0;
    let startY = 0;
    const handlePointerDown = (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };
    const handlePointerUp = (e: PointerEvent) => {
      const diffX = Math.abs(e.clientX - startX);
      const diffY = Math.abs(e.clientY - startY);
      if (diffX < 4 && diffY < 4) {
        measurer.create();
        setTimeout(() => {
          try {
            for (const line of measurer.lines) {
              line.displayRectangularDimensions();
            }
          } catch (err) {
            console.error("Failed to display rectangular dimensions on pointerup:", err);
          }
        }, 100);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        measurer.delete();
      }
    };

    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointerup", handlePointerUp);
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      measurer.enabled = false;
      measurer.pickerMode = OBF.GraphicVertexPickerMode.DEFAULT;
      cursurSurface.hide();

      measurer.list.onItemAdded.remove(handleItemAdded);

      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointerup", handlePointerUp);
      }
      window.removeEventListener("keydown", handleKeyDown);

      // Clean meshes from world.meshes
      for (const mesh of addedMeshes.current) {
        world.meshes.delete(mesh);
      }
      addedMeshes.current = [];
    };
  }, [components, world, activeTool, activeType]);

  if (!components) return null;

  const toggleLength = () => {
    const clipper = components.get(PiasClipper as any) as PiasClipper;
    const highlighter = components.get(OBF.Highlighter);

    if (activeTool === "measure" && activeType === "length") {
      // Deactivate
      clipper.exitPlacementMode();
      highlighter.enabled = true;
      setActiveTool("select");
      setActiveType(null);
    } else {
      // Activate Length
      clipper.exitPlacementMode();
      highlighter.enabled = false;
      setActiveTool("measure");
      setActiveType("length");
    }
  };

  const handleClearAll = () => {
    const measurer = components.get(OBF.LengthMeasurement);
    measurer.list.clear();
  };

  const handleSelectLine = (line: any) => {
    const measurer = components.get(OBF.LengthMeasurement);
    for (const l of measurer.list) {
      l.isSelected = l === line;
    }
    setSelectedLine(line.isSelected ? line : null);
    setLines([...measurer.list]);
  };

  const handleToggleLineVisible = (line: any, visible: boolean) => {
    line.visible = visible;
    const measurer = components.get(OBF.LengthMeasurement);
    setLines([...measurer.list]);
  };

  const handleDeleteLine = (line: any) => {
    line.dispose();
  };

  const isActive = activeTool === "measure";
  const buttonClass = `inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
    isActive || isDropdownOpen ? "text-accent-2 bg-surface-alt border-border" : "text-white"
  }`;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        className={buttonClass}
        title="Measurement Tools"
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <Icon name="RULER" size={20} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 text-left w-60 animate-in fade-in slide-in-from-right-1 duration-150">

          {/* ── Tools card ── */}
          <div className="rounded-xl bg-surface border border-border shadow-xl backdrop-blur-md flex flex-col gap-3.5 p-4">
            <span className="text-xs font-bold text-fg uppercase tracking-wider">Measurement Tools</span>

            <div className="flex flex-col gap-2">
              {/* Length */}
              <button
                type="button"
                onClick={toggleLength}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
                  activeTool === "measure" && activeType === "length"
                    ? "bg-accent-2/15 text-accent-2 border-accent-2"
                    : "text-fg hover:bg-surface-alt hover:border-border"
                }`}
              >
                <Icon name="RULER" size={16} />
                <span>Length</span>
              </button>

              {/* Angle */}
              <div className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted opacity-50 cursor-not-allowed font-semibold">
                <div className="flex items-center gap-3">
                  <Icon name="FOCUS" size={16} />
                  <span>Angle</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider bg-surface-alt border border-border px-1 py-0.5 rounded font-mono">Soon</span>
              </div>

              {/* Area */}
              <div className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted opacity-50 cursor-not-allowed font-semibold">
                <div className="flex items-center gap-3">
                  <Icon name="LAYOUT" size={16} />
                  <span>Area</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider bg-surface-alt border border-border px-1 py-0.5 rounded font-mono">Soon</span>
              </div>
            </div>

            {activeTool === "measure" && activeType === "length" && (
              <>
                <div className="h-[1px] bg-border/60" />
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs text-status-danger rounded-radius border border-transparent hover:bg-status-danger/10 hover:border-status-danger/20 transition-all duration-120 cursor-pointer font-semibold"
                >
                  <Icon name="CLOSE" size={16} />
                  <span>Clear all</span>
                </button>
              </>
            )}
          </div>

          {/* ── Measurements card ── */}
          {activeTool === "measure" && activeType === "length" && (
            <div className="rounded-xl bg-surface border border-border shadow-xl backdrop-blur-md flex flex-col">
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider px-4 pt-3 pb-2">
                Measurements
              </div>

              {lines.length === 0 ? (
                <div className="text-xs text-muted italic px-4 pb-4">No measurements added</div>
              ) : (
                <div className="flex flex-col gap-1 overflow-y-auto scroll-smooth px-2 pb-3 max-h-[160px]">
                  {lines.map((line, index) => {
                    const isSelected = line === selectedLine;
                    const labelText = line.label?.text || `${(line.value || 0).toFixed(2)}m`;
                    const isVisible = line.visible;

                    return (
                      <div
                        key={index}
                        className={`group flex items-center justify-between rounded-radius border border-transparent p-1 px-2.5 transition-all duration-120 cursor-pointer ${
                          isSelected
                            ? "bg-accent-2/15 text-accent-2 border-accent-2/30"
                            : "text-fg hover:bg-surface-alt"
                        }`}
                        onClick={() => handleSelectLine(line)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLineVisible(line, !isVisible);
                            }}
                            className={`flex items-center justify-center p-0.5 rounded cursor-pointer transition-colors ${
                              isVisible ? "text-accent-2" : "text-muted hover:text-fg"
                            }`}
                          >
                            <Icon name={isVisible ? "SHOW" : "HIDE"} size={16} />
                          </button>
                          <span className="text-xs truncate font-semibold">{labelText}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLine(line);
                          }}
                          className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-0.5 rounded text-muted hover:text-status-danger hover:bg-status-danger/10 transition-all cursor-pointer"
                        >
                          <Icon name="CLOSE" size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
