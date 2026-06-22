import { useEffect, useState, useRef } from "react";
import { useBimStore, BimTool } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { PiasClipper } from "@/bim-components/setup/src/clipper";

export function ViewportToolbar() {
  const { components, world, activeTool, setActiveTool } = useBimStore();
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGhostActive, setIsGhostActive] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const originalMaterialsData = useRef<Map<any, any>>(new Map());

  // Keep clipper and highlighter states coordinated
  useEffect(() => {
    if (!components) return;
    const clipper = components.get(PiasClipper as any) as PiasClipper;
    const highlighter = components.get(OBF.Highlighter);

    const handleClipperState = () => {
      if (!clipper.placing && activeTool === "clip") {
        setActiveTool("select");
        highlighter.enabled = true;
      }
    };

    clipper.onStateChanged.add(handleClipperState);
    return () => {
      clipper.onStateChanged.remove(handleClipperState);
    };
  }, [components, activeTool, setActiveTool]);

  // Click outside to close the dropdown menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsLoadOpen(false);
      }
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

  if (!components) return null;

  const handleToolToggle = (tool: BimTool) => {
    const clipper = components.get(PiasClipper as any) as PiasClipper;
    const highlighter = components.get(OBF.Highlighter);

    if (activeTool === tool) {
      clipper.exitPlacementMode();
      highlighter.enabled = true;
      setActiveTool("select");
      return;
    }

    if (tool === "select") {
      clipper.exitPlacementMode();
      highlighter.enabled = true;
      setActiveTool("select");
    } else if (tool === "clip") {
      highlighter.enabled = false;
      clipper.enterPlacementMode();
      setActiveTool("clip");
    } else if (tool === "measure") {
      clipper.exitPlacementMode();
      highlighter.enabled = false;
      setActiveTool("measure");
    } else {
      clipper.exitPlacementMode();
      highlighter.enabled = true;
      setActiveTool(null);
    }
  };

  const handleShowAll = async () => {
    const hider = components.get(OBC.Hider);
    await hider.set(true);
  };

  const handleToggleGhost = () => {
    const fragments = components.get(OBC.FragmentsManager);
    const materials = [...fragments.core.models.materials.list.values()];

    if (isGhostActive) {
      // Restore transparency
      for (const [material, data] of originalMaterialsData.current) {
        const { color, transparent, opacity, lodOpacity } = data;

        material.transparent = transparent;
        if ("color" in material) {
          material.opacity = opacity;
          material.color.setHex(color);
        } else {
          material.uniforms.lodColor.value.setHex(color);
          material.uniforms.lodOpacity.value = lodOpacity;
        }
        material.needsUpdate = true;
      }
      originalMaterialsData.current.clear();
      setIsGhostActive(false);
    } else {
      // Set model transparency (ghost mode)
      for (const material of materials) {
        if (material.userData.customId) continue;
        let color: number | undefined;
        let lodOpacity: number | undefined;
        if ("color" in material) {
          color = material.color.getHex();
        } else {
          color = material.lodColor.getHex();
          lodOpacity = material.uniforms.lodOpacity.value;
        }

        originalMaterialsData.current.set(material, {
          color,
          transparent: material.transparent,
          opacity: material.opacity,
          lodOpacity,
        });

        material.transparent = true;
        if ("color" in material) {
          material.opacity = 0.05;
          material.color.setColorName("white");
        } else {
          material.uniforms.lodColor.value.setColorName("white");
          material.uniforms.lodOpacity.value = 0.05;
        }
        material.needsUpdate = true;
      }
      setIsGhostActive(true);
    }
  };

  const camera = world?.camera as any;

  const handleToggleProjection = async () => {
    if (!camera || !world) return;
    const nextProj = camera.projection.current === "Perspective" ? "Orthographic" : "Perspective";
    await camera.projection.set(nextProj);
    camera.updateAspect();
    if (world.renderer && (world.renderer as any).postproduction) {
      (world.renderer as any).postproduction.updateCamera();
    }
    setIsSettingsOpen(false);
  };

  const handleTopView = async () => {
    if (!camera || !camera.controls) return;
    const controls = camera.controls;

    const target = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 1, 0.001); // offset to prevent gimbal lock
    direction.normalize();

    let distance = 20;
    const boxer = components?.get(OBC.BoundingBoxer);
    const fragments = components?.get(OBC.FragmentsManager);

    if (boxer && fragments && fragments.list.size > 0) {
      boxer.list.clear();
      boxer.addFromModels();
      const box = boxer.get();
      boxer.list.clear();

      box.getCenter(target);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      distance = maxDim * 1.5;
    } else {
      controls.getTarget(target);
      const position = new THREE.Vector3();
      controls.getPosition(position);
      distance = position.distanceTo(target);
      if (distance < 1) distance = 20;
    }

    controls.setLookAt(
      target.x + direction.x * distance,
      target.y + direction.y * distance,
      target.z + direction.z * distance,
      target.x,
      target.y,
      target.z,
      true
    );
    setIsSettingsOpen(false);
  };

  const handleLoadIfc = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;

      const ifcLoader = components.get(OBC.IfcLoader);
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const model = await ifcLoader.load(
            bytes,
            true,
            file.name.replace(".ifc", "")
          );
          if (model) {
            (model as any).name = file.name;
          }
        } catch (err) {
          console.error(`Failed to load IFC file "${file.name}":`, err);
        }
      }
    });

    input.click();
    setIsLoadOpen(false);
  };

  const handleLoadFrag = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;

      const fragments = components.get(OBC.FragmentsManager);
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          const model = await fragments.core.load(new Uint8Array(buffer), {
            modelId: file.name.replace(".frag", ""),
          });
          if (model) {
            (model as any).name = file.name;
          }
        } catch (err) {
          console.error(`Failed to load FRAG file "${file.name}":`, err);
        }
      }
    });

    input.click();
    setIsLoadOpen(false);
  };

  const getButtonClass = (tool: BimTool) => {
    const isActive = activeTool === tool;
    return `inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
      isActive ? "text-accent-2 bg-surface-alt border-border" : "text-muted"
    }`;
  };

  const getGhostButtonClass = () => {
    return `inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
      isGhostActive ? "text-accent-2 bg-surface-alt border-border" : "text-muted"
    }`;
  };

  const actionButtonClass =
    "inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-muted";

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 border border-border bg-surface/94 rounded-[14px] backdrop-blur-md">
      {/* Load Model dropdown */}
      <div className="relative flex items-center" ref={dropdownRef}>
        <button
          onClick={() => setIsLoadOpen(!isLoadOpen)}
          className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-muted"
          title="Load local model"
          type="button"
        >
          <Icon name="ADD" size={16} />
          <span>Load Model</span>
        </button>

        {isLoadOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-36 rounded-lg bg-surface border border-border shadow-lg z-50 overflow-hidden py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
            <button
              onClick={handleLoadFrag}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-alt transition-colors hover:text-accent-2 cursor-pointer"
              type="button"
            >
              Load FRAG
            </button>
            <button
              onClick={handleLoadIfc}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-alt transition-colors hover:text-accent-2 cursor-pointer"
              type="button"
            >
              Load IFC
            </button>
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-border" />

      {/* Measure and Clipper */}
      <button
        className={getButtonClass("measure")}
        title="Measure"
        type="button"
        onClick={() => handleToolToggle("measure")}
      >
        <Icon name="RULER" />
      </button>

      <button
        className={getButtonClass("clip")}
        title="Clip Planes"
        type="button"
        onClick={() => handleToolToggle("clip")}
      >
        <Icon name="CLIPPING" />
      </button>

      <div className="w-[1px] h-4 bg-border" />

      {/* Show All and Toggle Ghost */}
      <button
        className={actionButtonClass}
        title="Show All"
        type="button"
        onClick={handleShowAll}
      >
        <Icon name="SHOW" />
      </button>

      <button
        className={getGhostButtonClass()}
        title="Toggle Ghost (Transparency)"
        type="button"
        onClick={handleToggleGhost}
      >
        <Icon name="TRANSPARENT" />
      </button>

      <div className="w-[1px] h-4 bg-border" />

      {/* Viewport Settings */}
      <div className="relative flex items-center" ref={settingsDropdownRef}>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={actionButtonClass}
          title="Viewport Settings"
          type="button"
        >
          <Icon name="SETTINGS" />
        </button>

        {isSettingsOpen && (
          <div className="absolute bottom-full mb-2 right-0 w-44 rounded-lg bg-surface border border-border shadow-lg z-50 overflow-hidden py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
            <button
              onClick={handleToggleProjection}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-alt transition-colors hover:text-accent-2 cursor-pointer"
              type="button"
            >
              Toggle Projection
            </button>
            <button
              onClick={handleTopView}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-alt transition-colors hover:text-accent-2 cursor-pointer"
              type="button"
            >
              Top View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
