import { useState, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBF from "@thatopen/components-front";

interface AreaMeasureButtonProps {
  activeType: "length" | "angle" | "area" | null;
  setActiveType: (type: "length" | "angle" | "area" | null) => void;
}

export function AreaMeasureButton({ activeType, setActiveType }: AreaMeasureButtonProps) {
  const { components, activeTool, setActiveTool } = useBimStore();

  const toggleArea = () => {
    if (!components) return;
    const highlighter = components.get(OBF.Highlighter);

    if (activeTool === "measure" && activeType === "area") {
      // Deactivate
      highlighter.enabled = true;
      setActiveTool("select");
      setActiveType(null);
    } else {
      // Activate Area
      highlighter.enabled = false;
      setActiveTool("measure");
      setActiveType("area");
    }
  };

  const isActive = activeTool === "measure" && activeType === "area";

  return (
    <button
      type="button"
      onClick={toggleArea}
      className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
        isActive
          ? "bg-accent-2/15 text-accent-2 border-accent-2"
          : "text-fg hover:bg-surface-alt hover:border-border"
      }`}
    >
      <Icon name="LAYOUT" size={16} />
      <span>Area</span>
    </button>
  );
}

export function AreaMeasureList() {
  const { components, world, activeTool } = useBimStore();
  const [polygons, setPolygons] = useState<any[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<any | null>(null);
  const [visibilityMap, setVisibilityMap] = useState<Map<any, boolean>>(new Map());

  // Sync measurements list in React state
  useEffect(() => {
    if (!components || !world) return;

    const measurer = components.get(OBF.AreaMeasurement);

    const syncPolygons = () => {
      const list = [...measurer.list];
      setPolygons(list);
      setVisibilityMap(new Map(list.map((p) => [p, p.visible])));
      const selected = list.find((poly) => poly.isSelected) || null;
      setSelectedPolygon(selected);
    };

    // Initial sync
    syncPolygons();

    measurer.list.onItemAdded.add(syncPolygons);
    measurer.list.onItemDeleted.add(syncPolygons);

    return () => {
      measurer.list.onItemAdded.remove(syncPolygons);
      measurer.list.onItemDeleted.remove(syncPolygons);
    };
  }, [components, world]);

  if (!components || activeTool !== "measure") return null;

  const handleClearAll = () => {
    const measurer = components.get(OBF.AreaMeasurement);
    measurer.list.clear();
    setPolygons([]);
    setVisibilityMap(new Map());
    setSelectedPolygon(null);
  };

  const handleSelectPolygon = (poly: any) => {
    const measurer = components.get(OBF.AreaMeasurement);
    for (const p of measurer.list) {
      p.isSelected = p === poly;
    }
    setSelectedPolygon(poly.isSelected ? poly : null);
    setPolygons([...measurer.list]);
  };

  const handleTogglePolygonVisible = (poly: any, visible: boolean) => {
    poly.visible = visible;
    setVisibilityMap((prev) => new Map(prev).set(poly, visible));
  };

  const handleDeletePolygon = (poly: any) => {
    const measurer = components.get(OBF.AreaMeasurement);
    measurer.list.delete(poly);
  };

  return (
    <div className="rounded-xl bg-surface border border-border shadow-xl backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Measurements
        </span>
        {polygons.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] text-status-danger hover:underline cursor-pointer font-semibold"
          >
            Clear all
          </button>
        )}
      </div>

      {polygons.length === 0 ? (
        <div className="text-xs text-muted italic px-4 pb-4">No measurements added</div>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto scroll-smooth px-2 pb-3 max-h-[160px]">
          {polygons.map((poly, index) => {
            const isSelected = poly === selectedPolygon;
            const labelText = poly.label?.text || `${(poly.value || 0).toFixed(2)}m²`;
            const isVisible = visibilityMap.get(poly) ?? poly.visible;

            return (
              <div
                key={index}
                className={`group flex items-center justify-between rounded-radius border border-transparent p-1 px-2.5 transition-all duration-120 cursor-pointer ${
                  isSelected
                    ? "bg-accent-2/15 text-accent-2 border-accent-2/30"
                    : "text-fg hover:bg-surface-alt"
                }`}
                onClick={() => handleSelectPolygon(poly)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePolygonVisible(poly, !isVisible);
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
                    handleDeletePolygon(poly);
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
