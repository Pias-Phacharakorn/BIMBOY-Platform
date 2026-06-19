import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import {
  Focus,
  EyeOff,
  Eye,
  Scan,
  RotateCcw,
  Maximize2,
  Camera,
  Keyboard,
  Ghost,
  EyeClosed,
  Footprints,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { useOpenShortcutsHelp } from "./BimShortcuts";
import { SavedViewsMenu } from "./SavedViewsMenu";
import { SectionMenu } from "./SectionMenu";
import { MeasurementMenu } from "./MeasurementMenu";

/**
 * Sticky floating toolbar for the BIM viewer:
 *  - Focus selected element
 *  - Hide selected element
 *  - Isolate selected element (hide all others)
 *  - Show all (clear hidden)
 *  - Section plane (horizontal clipping plane + height slider)
 *  - Clear loaded model
 */
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
  const requestScreenshot = useDigitalTwinStore((s) => s.requestScreenshot);
  const hideUnselected = useDigitalTwinStore((s) => s.hideUnselected);
  const selectedElementIds = useDigitalTwinStore((s) => s.selectedElementIds);
  const openHelp = useOpenShortcutsHelp();
  const quality = useDigitalTwinStore((s) => s.qualityPreset);
  const setQualityPreset = useDigitalTwinStore((s) => s.setQualityPreset);
  const walkMode = useDigitalTwinStore((s) => s.walkMode);
  const toggleWalkMode = useDigitalTwinStore((s) => s.toggleWalkMode);

  const hiddenCount = Object.keys(hiddenIds).length + (isolatedElementId ? 1 : 0);

  // Anchor above the IoT overlay (collapsible) when it's visible so the
  // toolbar isn't covered by the lower panel.
  const iotActive = useDigitalTwinStore((s) => s.iotActive);
  const iotOverlayOpen = useDigitalTwinStore((s) => s.iotOverlayOpen);
  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const selectedEl = model?.elements.find((e) => e.id === selectedId);
  const overlayVisible = iotActive && !!selectedEl?.mqttTopic;
  const bottomOffset = overlayVisible ? (iotOverlayOpen ? 180 : 60) : 16;

  return (
    <div
      className="absolute left-1/2 z-20 -translate-x-1/2 transition-[bottom] duration-200"
      style={{ bottom: bottomOffset }}
    >
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card/90 px-1.5 py-1 shadow-lg backdrop-blur">
        <ToolBtn
          icon={<Focus className="h-4 w-4" />}
          label="Focus selected"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return toast.error("Select an element first");
            requestFocus(selectedId);
          }}
        />
        <ToolBtn
          icon={<EyeOff className="h-4 w-4" />}
          label="Hide selected"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return toast.error("Select an element first");
            hideElement(selectedId);
            toast.success("Element hidden");
          }}
        />
        <ToolBtn
          icon={<Scan className="h-4 w-4" />}
          label="Isolate selected"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return toast.error("Select an element first");
            isolateElement(selectedId);
            requestFocus(selectedId);
            toast.success("Isolated element");
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
          onClick={() => {
            hideUnselected();
            toast.success("Hidden all but selection");
          }}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <SectionMenu />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn
          icon={<Ghost className="h-4 w-4" />}
          label={`Ghost mode${ghostMode ? " (on)" : ""}`}
          active={ghostMode}
          onClick={() => {
            toggleGhostMode();
            toast.success(`Ghost mode ${!ghostMode ? "enabled" : "disabled"}`);
          }}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <MeasurementMenu />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn
          icon={<Maximize2 className="h-4 w-4" />}
          label="Zoom to Fit"
          onClick={() => {
            requestFit();
            toast.success("Zoomed to fit");
          }}
        />
        <ToolBtn
          icon={<RotateCcw className="h-4 w-4" />}
          label="Reset view"
          onClick={() => {
            resetView();
            toast.success("View reset to default");
          }}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <SavedViewsMenu />
        <ToolBtn
          icon={<Camera className="h-4 w-4" />}
          label="Screenshot (P)"
          onClick={() => {
            requestScreenshot();
            toast.success("Screenshot saved");
          }}
        />
        <ToolBtn
          icon={<Keyboard className="h-4 w-4" />}
          label="Keyboard shortcuts (?)"
          onClick={() => openHelp()}
        />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn
          icon={<Footprints className="h-4 w-4" />}
          label={`Walk mode${walkMode ? " (on — click viewport, WASD to move, Esc to exit)" : " (first-person)"}`}
          active={walkMode}
          onClick={() => {
            toggleWalkMode();
            toast.success(`Walk mode ${!walkMode ? "enabled — click viewport, WASD to move" : "disabled"}`);
          }}
        />
        <ToolBtn
          icon={
            <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase">
              <Gauge className="h-3.5 w-3.5" />
              {quality[0]}
            </span>
          }
          label={`Quality: ${quality} (click to cycle)`}
          onClick={() => {
            const next = quality === "low" ? "medium" : quality === "medium" ? "high" : "low";
            setQualityPreset(next);
            toast.success(`Quality: ${next}`);
          }}
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
