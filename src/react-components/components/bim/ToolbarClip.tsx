import { useState, useEffect, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { ClipperCursor, ClipperPlaneState } from "@/bim-components/ClipperCursor";
import * as OBF from "@thatopen/components-front";

export function ToolbarClip() {
  const { components, activeTool, setActiveTool } = useBimStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [planes, setPlanes] = useState<ClipperPlaneState[]>([]);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Sync ClipperCursor states
  useEffect(() => {
    if (!components) return;
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;

    const syncState = () => {
      setPlanes([...clipper.planes]);
      setSelectedPlaneId(clipper.selectedPlaneId);
      setPlacing(clipper.placing);
    };

    // Initial sync
    syncState();

    clipper.onStateChanged.add(syncState);
    return () => {
      clipper.onStateChanged.remove(syncState);
    };
  }, [components, isDropdownOpen]);

  // Keep clipper and highlighter states coordinated
  useEffect(() => {
    if (!components) return;
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
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

  // Exit clipper placement mode automatically if another tool becomes active
  useEffect(() => {
    if (!components) return;
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
    if (activeTool !== "clip" && clipper.placing) {
      clipper.exitPlacementMode();
    }
  }, [components, activeTool]);

  if (!components) return null;

  const handleEnterPlacement = () => {
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
    const highlighter = components.get(OBF.Highlighter);

    if (placing) {
      clipper.exitPlacementMode();
      highlighter.enabled = true;
      setActiveTool("select");
    } else {
      highlighter.enabled = false;
      clipper.enterPlacementMode();
      setActiveTool("clip");
    }
  };

  const handleClearAll = () => {
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
    const ids = clipper.planes.map((p) => p.id);
    ids.forEach((id) => clipper.deletePlane(id));
  };

  const handleSelectPlane = (id: string) => {
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
    clipper.selectPlane(id);
  };

  const handleTogglePlane = (id: string, enabled: boolean) => {
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
    clipper.togglePlane(id, enabled);
  };

  const handleDeletePlane = (id: string) => {
    const clipper = components.get(ClipperCursor as any) as ClipperCursor;
    clipper.deletePlane(id);
  };

  const isActive = activeTool === "clip";
  const buttonClass = `inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
    isActive || isDropdownOpen ? "text-accent-2 bg-surface-alt border-border" : "text-white"
  }`;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        className={buttonClass}
        title="Sectioning Tools"
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <Icon name="CLIPPING" size={20} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-full mr-2.5 top-0 z-50 rounded-xl bg-surface border border-border shadow-xl p-4 backdrop-blur-md animate-in fade-in slide-in-from-right-1 duration-150 flex flex-col gap-3.5 text-left w-60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg uppercase tracking-wider">Sectioning Tools</span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Add Plane */}
            <button
              type="button"
              onClick={handleEnterPlacement}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
                placing
                  ? "bg-accent-2/15 text-accent-2 border-accent-2"
                  : "text-fg hover:bg-surface-alt hover:border-border"
              }`}
            >
              <Icon name="ADD" size={16} />
              <span>{placing ? "Placing (ESC to cancel)" : "Add plane"}</span>
            </button>

            {/* Clear All */}
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-status-danger rounded-radius border border-transparent hover:bg-status-danger/10 hover:border-status-danger/20 transition-all duration-120 cursor-pointer font-semibold"
            >
              <Icon name="CLOSE" size={16} />
              <span>Clear all</span>
            </button>
          </div>

          <div className="h-[1px] bg-border/60 my-0.5" />

          {/* Collapsible/List Header */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted uppercase tracking-wider px-1">
            <span>Planes</span>
          </div>

          {/* Planes Checklist */}
          {planes.length === 0 ? (
            <div className="text-xs text-muted italic px-1">No planes added</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto scroll-smooth pr-1">
              {planes.map((plane) => {
                const isSelected = plane.id === selectedPlaneId;
                return (
                  <div
                    key={plane.id}
                    className={`group flex items-center justify-between rounded-radius border border-transparent p-1 px-2.5 transition-all duration-120 cursor-pointer ${
                      isSelected
                        ? "bg-accent-2/15 text-accent-2 border-accent-2/30"
                        : "text-fg hover:bg-surface-alt"
                    }`}
                    onClick={() => handleSelectPlane(plane.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePlane(plane.id, !plane.enabled);
                        }}
                        className={`flex items-center justify-center p-0.5 rounded cursor-pointer transition-colors ${
                          plane.enabled ? "text-accent-2" : "text-muted hover:text-fg"
                        }`}
                      >
                        <Icon name={plane.enabled ? "SHOW" : "HIDE"} size={16} />
                      </button>
                      <span className="text-xs truncate font-semibold">{plane.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlane(plane.id);
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
  );
}
