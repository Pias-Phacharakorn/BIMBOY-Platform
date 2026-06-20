import { useEffect, useState, useRef } from "react";
import { useBimStore, BimTool } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { PiasClipper } from "@/bim-components/setup/src/clipper";

export function ViewportToolbar() {
  const { components, activeTool, setActiveTool } = useBimStore();
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close the dropdown menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsLoadOpen(false);
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
      // Toggle off
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

  const handleIsolate = async () => {
    const highlighter = components.get(OBF.Highlighter);
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;

    const hider = components.get(OBC.Hider);
    await hider.isolate(selection);
  };

  const handleHide = async () => {
    const highlighter = components.get(OBF.Highlighter);
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;

    const hider = components.get(OBC.Hider);
    await hider.set(false, selection);
    await highlighter.clear("select");
  };

  const handleShowAll = async () => {
    const hider = components.get(OBC.Hider);
    await hider.set(true);
  };

  const handleLoadIfc = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const ifcLoader = components.get(OBC.IfcLoader);
        const model = await ifcLoader.load(
          bytes,
          true,
          file.name.replace(".ifc", "")
        );
        if (model) {
          (model as any).name = file.name;
        }
      } catch (err) {
        console.error("Failed to load IFC file:", err);
      }
    });

    input.click();
    setIsLoadOpen(false);
  };

  const handleLoadFrag = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const fragments = components.get(OBC.FragmentsManager);
        const model = await fragments.core.load(new Uint8Array(buffer), {
          modelId: file.name.replace(".frag", ""),
        });
        if (model) {
          (model as any).name = file.name;
        }
      } catch (err) {
        console.error("Failed to load FRAG file:", err);
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

  const actionButtonClass =
    "inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-muted";

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1.5 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-[14px] backdrop-blur-md">
      <button
        className={getButtonClass("select")}
        title="Select"
        type="button"
        onClick={() => handleToolToggle("select")}
      >
        <Icon name="SELECT" />
      </button>
      <button
        className={getButtonClass("measure")}
        title="Measure (Placeholder)"
        type="button"
        onClick={() => handleToolToggle("measure")}
      >
        <Icon name="RULER" />
      </button>
      <div className="w-[1px] my-1 bg-border" />
      <button
        className={getButtonClass("clip")}
        title="Clip Planes"
        type="button"
        onClick={() => handleToolToggle("clip")}
      >
        <Icon name="CLIPPING" />
      </button>
      <button
        className={actionButtonClass}
        title="Isolate Selection"
        type="button"
        onClick={handleIsolate}
      >
        <Icon name="ISOLATE" />
      </button>
      <button
        className={actionButtonClass}
        title="Hide Selection"
        type="button"
        onClick={handleHide}
      >
        <Icon name="HIDE" />
      </button>
      <button
        className={actionButtonClass}
        title="Show All"
        type="button"
        onClick={handleShowAll}
      >
        <Icon name="SHOW" />
      </button>

      <div className="w-[1px] my-1 bg-border" />

      <div className="relative flex items-center" ref={dropdownRef}>
        <button
          onClick={() => setIsLoadOpen(!isLoadOpen)}
          className={actionButtonClass}
          title="Load local model"
          aria-label="Load local model"
          type="button"
        >
          <Icon name="ADD" size={16} />
        </button>

        {isLoadOpen && (
          <div className="absolute bottom-full mb-2 right-0 w-36 rounded-lg bg-[oklch(14.5%_0.014_255_/_94%)] border border-border shadow-lg z-50 overflow-hidden py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
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
    </div>
  );
}

