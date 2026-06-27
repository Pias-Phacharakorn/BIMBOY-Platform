import { useState, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { LengthMeasureCursor } from "@/bim-components/setup/src/length-measure-cursor";
import * as OBF from "@thatopen/components-front";

interface LengthMeasureButtonProps {
  activeType: "length" | "angle" | "area" | "surface" | null;
  setActiveType: (type: "length" | "angle" | "area" | "surface" | null) => void;
}

export function LengthMeasureButton({ activeType, setActiveType }: LengthMeasureButtonProps) {
  const { components, activeTool, setActiveTool } = useBimStore();

  const toggleLength = () => {
    if (!components) return;
    const highlighter = components.get(OBF.Highlighter);

    if (activeTool === "measure" && activeType === "length") {
      // Deactivate
      highlighter.enabled = true;
      setActiveTool("select");
      setActiveType(null);
    } else {
      // Activate Length
      highlighter.enabled = false;
      setActiveTool("measure");
      setActiveType("length");
    }
  };

  const isActive = activeTool === "measure" && activeType === "length";

  return (
    <button
      type="button"
      onClick={toggleLength}
      className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
        isActive
          ? "bg-accent-2/15 text-accent-2 border-accent-2"
          : "text-fg hover:bg-surface-alt hover:border-border"
      }`}
    >
      <Icon name="RULER" size={16} />
      <span>Length</span>
    </button>
  );
}

export function LengthMeasureList() {
  const { components, world, activeTool } = useBimStore();
  const [lines, setLines] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState<any | null>(null);
  const [visibilityMap, setVisibilityMap] = useState<Map<any, boolean>>(new Map());

  // Sync measurements list in React state
  useEffect(() => {
    if (!components || !world) return;

    const measurer = components.get(OBF.LengthMeasurement);

    const syncLines = () => {
      const list = [...measurer.list];
      setLines(list);
      setVisibilityMap(new Map(list.map((l) => [l, l.visible])));
      const selected = list.find((line) => line.isSelected) || null;
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
  }, [components, world]);

  if (!components || activeTool !== "measure") return null;

  const handleClearAll = () => {
    const measurer = components.get(OBF.LengthMeasurement);
    measurer.list.clear();
    setLines([]);
    setVisibilityMap(new Map());
    setSelectedLine(null);
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
    setVisibilityMap((prev) => new Map(prev).set(line, visible));
  };

  const handleDeleteLine = (line: any) => {
    const measurer = components.get(OBF.LengthMeasurement);
    measurer.list.delete(line);
  };

  return (
    <div className="rounded-xl bg-surface border border-border shadow-xl backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Measurements
        </span>
        {lines.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] text-status-danger hover:underline cursor-pointer font-semibold"
          >
            Clear all
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="text-xs text-muted italic px-4 pb-4">No measurements added</div>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto scroll-smooth px-2 pb-3 max-h-[240px]">
          {lines.map((line, index) => {
            const isSelected = line === selectedLine;
            const labelText = line.label?.text || `${(line.value || 0).toFixed(2)}m`;
            const isVisible = visibilityMap.get(line) ?? line.visible;

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
  );
}
