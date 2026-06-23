import { useState, useEffect, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { LengthMeasureButton, LengthMeasureList } from "./LengthMeasure";
import { AreaMeasureButton, AreaMeasureList } from "./AreaMeasure";
import { LengthMeasureCursor } from "@/bim-components/setup/src/length-measure-cursor";
import { AreaMeasureCursor } from "@/bim-components/setup/src/area-measure-cursor";

export function ToolbarMeasure() {
  const { components, world, activeTool } = useBimStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeType, setActiveType] = useState<"length" | "angle" | "area" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown, ignoring canvas clicks during active measurement
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // If clicking the 3D viewport canvas while measuring, keep the dropdown open
        const canvas = world?.renderer?.three?.domElement;
        if (activeTool === "measure" && event.target === canvas) {
          return;
        }
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [world, activeTool]);

  // Sync activeType with activeTool
  useEffect(() => {
    if (activeTool !== "measure") {
      setActiveType(null);
    }
  }, [activeTool]);

  // Enable/disable the custom LengthMeasureCursor component based on tool state
  useEffect(() => {
    if (!components || !world) return;

    const cursor = components.get(LengthMeasureCursor);
    const active = activeTool === "measure" && activeType === "length";

    cursor.enabled = active;

    return () => {
      cursor.enabled = false;
    };
  }, [components, world, activeTool, activeType]);

  // Enable/disable the custom AreaMeasureCursor component based on tool state
  useEffect(() => {
    if (!components || !world) return;

    const cursor = components.get(AreaMeasureCursor);
    const active = activeTool === "measure" && activeType === "area";

    cursor.enabled = active;

    return () => {
      cursor.enabled = false;
    };
  }, [components, world, activeTool, activeType]);

  if (!components) return null;

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
              {/* Length Button */}
              <LengthMeasureButton activeType={activeType} setActiveType={setActiveType} />

              {/* Angle */}
              <div className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted opacity-50 cursor-not-allowed font-semibold">
                <div className="flex items-center gap-3">
                  <Icon name="FOCUS" size={16} />
                  <span>Angle</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider bg-surface-alt border border-border px-1 py-0.5 rounded font-mono">Soon</span>
              </div>

              {/* Area Button */}
              <AreaMeasureButton activeType={activeType} setActiveType={setActiveType} />
            </div>
          </div>

          {/* ── Measurements list card ── */}
          {activeTool === "measure" && activeType === "length" && (
            <LengthMeasureList />
          )}

          {activeTool === "measure" && activeType === "area" && (
            <AreaMeasureList />
          )}
        </div>
      )}
    </div>
  );
}
