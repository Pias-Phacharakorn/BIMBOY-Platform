import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Activity, ChevronUp, ChevronDown } from "lucide-react";

export function IotOverlay() {
  const open = useDigitalTwinStore((s) => s.iotOverlayOpen);
  const setOpen = useDigitalTwinStore((s) => s.setIotOverlayOpen);
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const iotActive = useDigitalTwinStore((s) => s.iotActive);
  const mqtt = useDigitalTwinStore((s) => s.mqttLiveData);

  const el = model?.elements.find((e) => e.id === selectedId);
  const live = el?.mqttTopic ? mqtt[el.mqttTopic] : undefined;

  if (!iotActive) return null;
  if (!el || !el.mqttTopic) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-border bg-card/90 backdrop-blur shadow-lg">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[hsl(var(--info))]" />
          <span className="text-sm font-medium">Live IoT · {el.name}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-3 border-t border-border px-4 py-3">
          <Metric label="Current" value={live ? `${live.value} ${live.unit}` : "—"} />
          <Metric label="Topic" value={el.mqttTopic} mono />
          <Metric label="Updated" value={live ? new Date(live.ts).toLocaleTimeString() : "Waiting…"} />
          {live && (
            <div className="col-span-3">
              <Sparkline data={live.history.map((h) => h.v)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${mono ? "font-mono text-xs" : ""} truncate`}>{value}</p>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 30 - ((v - min) / range) * 28;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-12 w-full">
      <polyline points={pts.join(" ")} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}