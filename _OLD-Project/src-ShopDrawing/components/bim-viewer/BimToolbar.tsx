import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import {
  Focus,
  EyeOff,
  Eye,
  Scan,
  RotateCcw,
  Maximize2,
  Keyboard,
  Ghost,
  EyeClosed,
  Footprints,
  Sparkles,
  PlaneTakeoff,
} from "lucide-react";
import { useOpenShortcutsHelp } from "./BimShortcuts";
import { SavedViewsMenu } from "./SavedViewsMenu";
import { ClipperMenu } from "./ClipperMenu";
import { MeasurementMenu } from "./MeasurementMenu";

export function BimToolbar() {
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const hiddenIds = useDigitalTwinStore((s) => s.hiddenIds);
  const isolatedElementId = useDigitalTwinStore((s) => s.isolatedElementId);
  const hideElement = useDigitalTwinStore((s) => s.hideElement);
  const showAllElements = useDigitalTwinStore((s) => s.showAllElements);
  const isolateElement = useDigitalTwinStore((s) => s.isolateElement);
  const requestFocus = useDigitalTwinStore((s) => s.requestFocus);
  const ghostMode = useDigitalTwinStore((s) => s.ghostMode);
  const toggleGhostMode = useDigitalTwinStore((s) => s.toggleGhostMode);
  const resetView = useDigitalTwinStore((s) => s.resetView);
  const requestFit = useDigitalTwinStore((s) => s.requestFit);
  
  const hideUnselected = useDigitalTwinStore((s) => s.hideUnselected);
  const selectedElementIds = useDigitalTwinStore((s) => s.selectedElementIds);
  const openHelp = useOpenShortcutsHelp();
  const renderStyle = useDigitalTwinStore((s) => s.renderStyle);
  const setRenderStyle = useDigitalTwinStore((s) => s.setRenderStyle);
  const walkMode = useDigitalTwinStore((s) => s.walkMode);
  const toggleWalkMode = useDigitalTwinStore((s) => s.toggleWalkMode);
  const flyMode = useDigitalTwinStore((s) => s.flyMode);
  const toggleFlyMode = useDigitalTwinStore((s) => s.toggleFlyMode);

  const hiddenCount = Object.keys(hiddenIds).length + (isolatedElementId ? 1 : 0);

  return (
    <div className="absolute left-1/2 z-20 -translate-x-1/2 transition-[bottom] duration-200" style={{ bottom: 16 }}>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card/90 px-1.5 py-1 shadow-lg backdrop-blur">
        <ToolBtn
          icon={<Focus className="h-4 w-4" />}
          label="Focus selected"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            requestFocus(selectedId);
          }}
        />
        <ToolBtn
          icon={<EyeOff className="h-4 w-4" />}
          label="Hide selected"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            hideElement(selectedId);
          }}
        />
        <ToolBtn
          icon={<Scan className="h-4 w-4" />}
          label="Isolate selected"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            isolateElement(selectedId);
            requestFocus(selectedId);
          }}
        />
        <ToolBtn
          icon={<Eye className="h-4 w-4" />}
          label={`Show all${hiddenCount ? ` (${hiddenCount})` : ""}`}
          disabled={hiddenCount === 0}
          onClick={() => showAllElements()}
        />
        <ToolBtn
          icon={<EyeClosed className="h-4 w-4" />}
          label={`Hide unselected${selectedElementIds.length > 1 ? ` (${selectedElementIds.length})` : ""}`}
          disabled={!selectedId && selectedElementIds.length === 0}
          onClick={() => hideUnselected()}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <ClipperMenu />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn
          icon={<Ghost className="h-4 w-4" />}
          label={`Ghost mode${ghostMode ? " (on)" : ""}`}
          active={ghostMode}
          onClick={() => toggleGhostMode()}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <MeasurementMenu />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn
          icon={<Maximize2 className="h-4 w-4" />}
          label="Zoom to Fit"
          onClick={() => requestFit()}
        />
        <ToolBtn
          icon={<RotateCcw className="h-4 w-4" />}
          label="Reset view"
          onClick={() => resetView()}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <SavedViewsMenu />
        <ToolBtn
          icon={<Keyboard className="h-4 w-4" />}
          label="Keyboard shortcuts (?)"
          onClick={() => openHelp()}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn
          icon={<Footprints className="h-4 w-4" />}
          label={`Walk${walkMode ? " (on — click viewport, WASD to move, Esc to exit)" : " — first-person, walk on top of geometry"}`}
          active={walkMode}
          onClick={() => toggleWalkMode()}
        />
        <ToolBtn
          icon={<PlaneTakeoff className="h-4 w-4" />}
          label={`Fly${flyMode ? " (on — click viewport, WASD + Space/Ctrl to move, Esc to exit)" : " — free 6DOF fly-through"}`}
          active={flyMode}
          onClick={() => toggleFlyMode()}
        />
        <ToolBtn
          icon={<Sparkles className="h-4 w-4" />}
          label={`Render: ${renderStyle === "basic" ? "Basic" : "Color Shadows"} (click to toggle)`}
          active={renderStyle === "color-shadows"}
          onClick={() => setRenderStyle(renderStyle === "basic" ? "color-shadows" : "basic")}
        />
      </div>
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`group relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
      }`}
    >
      {icon}
      <span className="pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded bg-popover px-2 py-0.5 text-[10px] text-popover-foreground opacity-0 shadow group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}
