// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBF from "@thatopen/components-front";
import { SurfaceMeasureCursor, SurfaceMeasurement } from "@/bim-components/setup/src/surface-measure-cursor";

// ─── Button ──────────────────────────────────────────────────────────────────

interface SurfaceMeasureButtonProps {
  activeType: "length" | "angle" | "area" | "surface" | null;
  setActiveType: (type: "length" | "angle" | "area" | "surface" | null) => void;
}

export function SurfaceMeasureButton({ activeType, setActiveType }: SurfaceMeasureButtonProps) {
  const { components, activeTool, setActiveTool } = useBimStore();

  const toggleSurface = () => {
    if (!components) return;
    const highlighter = components.get(OBF.Highlighter);

    if (activeTool === "measure" && activeType === "surface") {
      // Deactivate
      highlighter.enabled = true;
      setActiveTool("select");
      setActiveType(null);
    } else {
      // Activate Surface
      highlighter.enabled = false;
      setActiveTool("measure");
      setActiveType("surface");
    }
  };

  const isActive = activeTool === "measure" && activeType === "surface";

  return (
    <button
      type="button"
      onClick={toggleSurface}
      className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
        isActive
          ? "bg-accent-2/15 text-accent-2 border-accent-2"
          : "text-fg hover:bg-surface-alt hover:border-border"
      }`}
    >
      <Icon name="FOCUS" size={16} />
      <span>Surface</span>
    </button>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function SurfaceMeasureList() {
  const { components, world, activeTool } = useBimStore();
  const [measurements, setMeasurements] = useState<SurfaceMeasurement[]>([]);
  const [visibilityMap, setVisibilityMap] = useState<Map<string, boolean>>(new Map());

  const sync = useCallback(() => {
    if (!components) return;
    const cursor = components.get(SurfaceMeasureCursor);
    const list = [...cursor.measurements];
    setMeasurements(list);
    setVisibilityMap(new Map(list.map((m) => [m.id, m.visible])));
  }, [components]);

  useEffect(() => {
    if (!components || !world) return;

    const cursor = components.get(SurfaceMeasureCursor);

    cursor.onMeasurementAdded.add(sync);
    cursor.onMeasurementDeleted.add(sync);

    // Initial sync
    sync();

    return () => {
      cursor.onMeasurementAdded.remove(sync);
      cursor.onMeasurementDeleted.remove(sync);
    };
  }, [components, world, sync]);

  if (!components || activeTool !== "measure") return null;

  const handleClearAll = () => {
    if (!components) return;
    const cursor = components.get(SurfaceMeasureCursor);
    cursor.clearAll();
    setMeasurements([]);
    setVisibilityMap(new Map());
  };

  const handleToggleVisible = (id: string, visible: boolean) => {
    if (!components) return;
    const cursor = components.get(SurfaceMeasureCursor);
    cursor.setMeasurementVisible(id, visible);
    setVisibilityMap((prev) => new Map(prev).set(id, visible));
  };

  const handleDelete = (id: string) => {
    if (!components) return;
    const cursor = components.get(SurfaceMeasureCursor);
    cursor.deleteMeasurement(id);
    // sync fires via event
  };

  return (
    <div className="rounded-xl bg-surface border border-border shadow-xl backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Surface Measurements
        </span>
        {measurements.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] text-status-danger hover:underline cursor-pointer font-semibold"
          >
            Clear all
          </button>
        )}
      </div>

      {measurements.length === 0 ? (
        <div className="text-xs text-muted italic px-4 pb-4">No measurements added</div>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto scroll-smooth px-2 pb-3 max-h-[240px]">
          {measurements.map((m, index) => {
            const isVisible = visibilityMap.get(m.id) ?? m.visible;
            const areaText = `~ ${m.area.toFixed(1)} m²`;

            return (
              <div
                key={m.id}
                className="group flex items-center justify-between rounded-radius border border-transparent p-1 px-2.5 transition-all duration-120 text-fg hover:bg-surface-alt"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisible(m.id, !isVisible);
                    }}
                    className={`flex items-center justify-center p-0.5 rounded cursor-pointer transition-colors ${
                      isVisible ? "text-accent-2" : "text-muted hover:text-fg"
                    }`}
                  >
                    <Icon name={isVisible ? "SHOW" : "HIDE"} size={16} />
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate font-semibold">{`Surface ${index + 1}`}</span>
                    <span className="text-[10px] text-muted truncate">{areaText}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(m.id);
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
