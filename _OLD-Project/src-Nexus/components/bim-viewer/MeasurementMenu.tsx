import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Ruler, Spline, Triangle, Trash2 } from "lucide-react";

/**
 * Combined measurement tool. A single toolbar button opens a popover with
 * Distance / Area / Angle mode toggles + a Clear action. Modeled after the
 * ThatOpen LengthMeasurement example: pick points with double-click in the
 * viewport, right-click (or Enter) to finish multi-point measurements.
 */
export function MeasurementMenu() {
  const measureMode = useDigitalTwinStore((s) => s.measureMode);
  const setMeasureMode = useDigitalTwinStore((s) => s.setMeasureMode);
  const measurements = useDigitalTwinStore((s) => s.measurements);
  const clearMeasurements = useDigitalTwinStore((s) => s.clearMeasurements);

  const anyActive = measureMode !== "off";
  const count = measurements.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Measurement tools"
          className={`group relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            anyActive
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <Ruler className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1 text-[9px] font-bold text-accent-foreground">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={10} className="w-72 p-3">
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          <ModeBtn
            label="Distance"
            icon={<Ruler className="h-5 w-5" />}
            active={measureMode === "distance"}
            onClick={() => setMeasureMode(measureMode === "distance" ? "off" : "distance")}
          />
          <ModeBtn
            label="Area"
            icon={<Spline className="h-5 w-5" />}
            active={measureMode === "area"}
            onClick={() => setMeasureMode(measureMode === "area" ? "off" : "area")}
          />
          <ModeBtn
            label="Angle"
            icon={<Triangle className="h-5 w-5" />}
            active={measureMode === "angle"}
            onClick={() => setMeasureMode(measureMode === "angle" ? "off" : "angle")}
          />
        </div>
        <p className="mb-2 rounded bg-muted/50 px-2 py-1.5 text-[10px] leading-tight text-muted-foreground">
          Double-click in the viewport to place points (snaps to vertex/edge/face).
          Right-click or press Enter to finish area/angle. Press Esc to cancel.
        </p>
        <button
          onClick={() => {
            clearMeasurements();
            setMeasureMode("off");
          }}
          disabled={count === 0 && measureMode === "off"}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear measurements{count ? ` (${count})` : ""}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function ModeBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[10px] transition-colors ${
        active
          ? "border-[hsl(var(--accent))] bg-accent/20 text-accent-foreground"
          : "border-border text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}