import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Scissors, Box, MousePointerClick } from "lucide-react";
import { toast } from "sonner";

/**
 * Combined sectioning tool. A single toolbar button opens a popover above the
 * toolbar with X / Y / Z plane toggles (+ sliders) and a Snap-Face picker that
 * sets a section plane from the next clicked geometry face.
 */
export function SectionMenu() {
  const sectionEnabled = useDigitalTwinStore((s) => s.sectionEnabled);
  const sectionY = useDigitalTwinStore((s) => s.sectionY);
  const sectionMin = useDigitalTwinStore((s) => s.sectionMin);
  const sectionMax = useDigitalTwinStore((s) => s.sectionMax);
  const setSectionY = useDigitalTwinStore((s) => s.setSectionY);
  const toggleSection = useDigitalTwinStore((s) => s.toggleSection);
  const sectionAxisX = useDigitalTwinStore((s) => s.sectionAxisX);
  const sectionAxisZ = useDigitalTwinStore((s) => s.sectionAxisZ);
  const sectionX = useDigitalTwinStore((s) => s.sectionX);
  const sectionZ = useDigitalTwinStore((s) => s.sectionZ);
  const sectionXMin = useDigitalTwinStore((s) => s.sectionXMin);
  const sectionXMax = useDigitalTwinStore((s) => s.sectionXMax);
  const sectionZMin = useDigitalTwinStore((s) => s.sectionZMin);
  const sectionZMax = useDigitalTwinStore((s) => s.sectionZMax);
  const toggleSectionAxis = useDigitalTwinStore((s) => s.toggleSectionAxis);
  const setSectionAxis = useDigitalTwinStore((s) => s.setSectionAxis);
  const snapFaceMode = useDigitalTwinStore((s) => s.snapFaceMode);
  const setSnapFaceMode = useDigitalTwinStore((s) => s.setSnapFaceMode);

  const anyActive = sectionEnabled || sectionAxisX || sectionAxisZ || snapFaceMode;
  const activeCount = (sectionEnabled ? 1 : 0) + (sectionAxisX ? 1 : 0) + (sectionAxisZ ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Section tools"
          className={`group relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            anyActive
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <Scissors className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1 text-[9px] font-bold text-accent-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-72 p-3"
      >
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          <PlaneBtn
            label="X Plane"
            axis="x"
            active={sectionAxisX}
            onClick={() => toggleSectionAxis("x")}
          />
          <PlaneBtn
            label="Y Plane"
            axis="y"
            active={sectionEnabled}
            onClick={() => toggleSection()}
          />
          <PlaneBtn
            label="Z Plane"
            axis="z"
            active={sectionAxisZ}
            onClick={() => toggleSectionAxis("z")}
          />
          <button
            onClick={() => {
              const next = !snapFaceMode;
              setSnapFaceMode(next);
              if (next) toast.info("Click any face to snap section plane");
            }}
            className={`flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[10px] transition-colors ${
              snapFaceMode
                ? "border-[hsl(var(--accent))] bg-accent/20 text-accent-foreground"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <Box className="h-5 w-5" />
              <MousePointerClick className="absolute -bottom-0.5 -right-1 h-3 w-3" />
            </span>
            <span className="font-medium">Snap Face</span>
          </button>
        </div>

        {(sectionAxisX || sectionEnabled || sectionAxisZ) && (
          <div className="space-y-2 border-t border-border pt-2">
            {sectionAxisX && (
              <AxisSlider
                label="X"
                min={sectionXMin}
                max={sectionXMax}
                value={sectionX}
                onChange={(v) => setSectionAxis("x", v)}
              />
            )}
            {sectionEnabled && (
              <AxisSlider
                label="Y"
                min={sectionMin}
                max={sectionMax}
                value={sectionY}
                onChange={setSectionY}
              />
            )}
            {sectionAxisZ && (
              <AxisSlider
                label="Z"
                min={sectionZMin}
                max={sectionZMax}
                value={sectionZ}
                onChange={(v) => setSectionAxis("z", v)}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PlaneBtn({
  label,
  axis,
  active,
  onClick,
}: {
  label: string;
  axis: "x" | "y" | "z";
  active: boolean;
  onClick: () => void;
}) {
  const color = active ? "text-accent" : "text-foreground";
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[10px] transition-colors ${
        active
          ? "border-[hsl(var(--accent))] bg-accent/20 text-accent-foreground"
          : "border-border text-foreground hover:bg-muted"
      }`}
    >
      <PlaneIcon axis={axis} className={`h-6 w-6 ${color}`} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function PlaneIcon({ axis, className }: { axis: "x" | "y" | "z"; className?: string }) {
  // Simple isometric plane icon with an arrow on the dominant axis.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M4 8 L14 4 L20 8 L10 12 Z" strokeLinejoin="round" />
      {axis === "x" && <path d="M14 18 L22 18 M19 15 L22 18 L19 21" strokeLinecap="round" strokeLinejoin="round" />}
      {axis === "y" && <path d="M12 22 L12 14 M9 17 L12 14 L15 17" strokeLinecap="round" strokeLinejoin="round" />}
      {axis === "z" && <path d="M4 14 L12 18 M4 14 L7 12 M4 14 L7 16" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function AxisSlider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-center text-[10px] font-bold text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={(max - min) / 500 || 0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 accent-[hsl(var(--accent))]"
      />
      <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">
        {value.toFixed(2)}
      </span>
    </div>
  );
}