import { useState, useEffect, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { SpotCoordinate } from "@/bim-components";
import * as OBF from "@thatopen/components-front";

export function ToolbarCoordinate() {
  const { components, activeTool, setActiveTool } = useBimStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [labels, setLabels] = useState<any[]>([]);
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

  // Sync placed coordinates
  useEffect(() => {
    if (!components) return;
    const spotCoordinate = components.get(SpotCoordinate);

    const syncLabels = () => {
      setLabels([...spotCoordinate.labelManager.labels]);
    };

    syncLabels();

    spotCoordinate.onLabelsChanged.add(syncLabels);
    return () => {
      spotCoordinate.onLabelsChanged.remove(syncLabels);
    };
  }, [components]);

  // Toggle SpotCoordinate / Highlighter based on active tool
  useEffect(() => {
    if (!components) return;
    const spotCoordinate = components.get(SpotCoordinate);
    const highlighter = components.get(OBF.Highlighter);

    if (activeTool === "coordinate") {
      highlighter.enabled = false;
      spotCoordinate.enabled = true;
    } else {
      spotCoordinate.enabled = false;
      highlighter.enabled = true;
    }
  }, [components, activeTool]);

  // Ensure clean teardown on unmount
  useEffect(() => {
    return () => {
      if (!components) return;
      const spotCoordinate = components.get(SpotCoordinate);
      const highlighter = components.get(OBF.Highlighter);
      spotCoordinate.enabled = false;
      highlighter.enabled = true;
    };
  }, [components]);

  if (!components) return null;

  const handleToggleTool = () => {
    setActiveTool(activeTool === "coordinate" ? "select" : "coordinate");
  };

  const handleClearAll = () => {
    const spotCoordinate = components.get(SpotCoordinate);
    spotCoordinate.clearSpotLabels();
  };

  const handleDeleteLabel = (id: string) => {
    const spotCoordinate = components.get(SpotCoordinate);
    spotCoordinate.labelManager.deleteLabel(id);
  };

  const isActive = activeTool === "coordinate";
  const buttonClass = `inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
    isActive || isDropdownOpen ? "text-accent-2 bg-surface-alt border-border" : "text-white"
  }`;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        className={buttonClass}
        title="Coordinate Tools"
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <Icon name="COORDINATE" size={20} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-full mr-2.5 top-0 z-50 rounded-xl bg-surface border border-border shadow-xl p-4 backdrop-blur-md animate-in fade-in slide-in-from-right-1 duration-150 flex flex-col gap-3.5 text-left w-60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg uppercase tracking-wider">Coordinate Tools</span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Toggle Tool */}
            <button
              type="button"
              onClick={handleToggleTool}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
                isActive
                  ? "bg-accent-2/15 text-accent-2 border-accent-2"
                  : "text-fg hover:bg-surface-alt hover:border-border"
              }`}
            >
              <Icon name="ADD" size={16} />
              <span>{isActive ? "Placing (double-click model)" : "Add coordinate"}</span>
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
            <span>Coordinates</span>
          </div>

          {/* Coordinates List */}
          {labels.length === 0 ? (
            <div className="text-xs text-muted italic px-1">No coordinates placed</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto scroll-smooth pr-1">
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="group flex items-center justify-between rounded-radius border border-transparent p-1 px-2.5 transition-all duration-120 text-fg hover:bg-surface-alt"
                >
                  <div className="flex flex-col min-w-0 text-xs font-semibold">
                    <span>X: {label.displayPoint.x.toFixed(3)} m</span>
                    <span>Y: {label.displayPoint.y.toFixed(3)} m</span>
                    <span>Z: {label.displayPoint.z.toFixed(3)} m</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLabel(label.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-0.5 rounded text-muted hover:text-status-danger hover:bg-status-danger/10 transition-all cursor-pointer"
                  >
                    <Icon name="CLOSE" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
