import { Handle, Position, NodeProps } from "reactflow";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { KNOWN_TOPICS } from "@/hooks/useMockMqtt";
import { Radio, Filter, Send, Box, Crosshair } from "lucide-react";

const baseCard =
  "rounded-lg border bg-card shadow-sm min-w-[220px] text-xs overflow-hidden";

export function InputNode({ data, id }: NodeProps) {
  return (
    <div className={`${baseCard} border-[hsl(var(--info))]/40`}>
      <Header icon={<Radio className="h-3.5 w-3.5" />} title="MQTT Input" tint="info" />
      <div className="p-3 space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">Topic</label>
        <select
          className="nodrag w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          value={data.topic ?? ""}
          onChange={(e) => data.onChange?.(id, { topic: e.target.value })}
        >
          <option value="">Select topic…</option>
          {KNOWN_TOPICS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--info))]" />
    </div>
  );
}

export function ConditionNode({ data, id }: NodeProps) {
  return (
    <div className={`${baseCard} border-[hsl(var(--warning))]/40`}>
      <Header icon={<Filter className="h-3.5 w-3.5" />} title="Threshold" tint="warning" />
      <div className="p-3 grid grid-cols-2 gap-2">
        <select
          className="nodrag rounded border border-border bg-background px-2 py-1.5 text-xs"
          value={data.op ?? ">"}
          onChange={(e) => data.onChange?.(id, { op: e.target.value })}
        >
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
          <option value=">=">≥</option>
          <option value="<=">≤</option>
        </select>
        <input
          type="number"
          className="nodrag rounded border border-border bg-background px-2 py-1.5 text-xs"
          placeholder="40"
          value={data.value ?? ""}
          onChange={(e) => data.onChange?.(id, { value: parseFloat(e.target.value) })}
        />
      </div>
      <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--warning))]" />
      <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--warning))]" />
    </div>
  );
}

export function BimMapNode({ data, id }: NodeProps) {
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const bimActive = useDigitalTwinStore((s) => s.bimActive);
  return (
    <div className={`${baseCard} border-accent/40`}>
      <Header icon={<Box className="h-3.5 w-3.5" />} title="BIM Element Mapping" tint="accent" />
      <div className="p-3 space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">IFC Element ID</label>
        <input
          type="text"
          className="nodrag w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
          placeholder="IFC-PIPE-003"
          value={data.elementId ?? ""}
          onChange={(e) => data.onChange?.(id, { elementId: e.target.value })}
        />
        <button
          type="button"
          disabled={!bimActive || !selectedId}
          onClick={() => data.onChange?.(id, { elementId: selectedId })}
          className="nodrag flex w-full items-center justify-center gap-1.5 rounded bg-accent/15 px-2 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
        >
          <Crosshair className="h-3 w-3" />
          {bimActive ? (selectedId ? `Use ${selectedId}` : "Pick from 3D viewer") : "BIM module disabled"}
        </button>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-accent" />
      <Handle type="source" position={Position.Right} className="!bg-accent" />
    </div>
  );
}

export function ActionNode({ data, id }: NodeProps) {
  return (
    <div className={`${baseCard} border-[hsl(var(--success))]/40`}>
      <Header icon={<Send className="h-3.5 w-3.5" />} title="Send Alert" tint="success" />
      <div className="p-3 space-y-2">
        <select
          className="nodrag w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          value={data.channel ?? "LINE"}
          onChange={(e) => data.onChange?.(id, { channel: e.target.value })}
        >
          <option value="LINE">LINE Push</option>
          <option value="Telegram">Telegram Bot</option>
          <option value="Webhook">Generic Webhook</option>
        </select>
        <input
          type="text"
          className="nodrag w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          placeholder="Alert message…"
          value={data.message ?? ""}
          onChange={(e) => data.onChange?.(id, { message: e.target.value })}
        />
      </div>
      <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--success))]" />
    </div>
  );
}

function Header({ icon, title, tint }: { icon: React.ReactNode; title: string; tint: string }) {
  const bg: Record<string, string> = {
    info: "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]",
    warning: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
    success: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
    accent: "bg-accent/10 text-accent",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 font-medium ${bg[tint]}`}>
      {icon}
      {title}
    </div>
  );
}

export const nodeTypes = {
  input: InputNode,
  condition: ConditionNode,
  bimMap: BimMapNode,
  action: ActionNode,
};