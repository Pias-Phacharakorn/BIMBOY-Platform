import { useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "./nodes";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Plus, Radio, Filter, Box, Send, Cloud, CloudOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getWorkflowConfig, saveWorkflowConfig } from "@/lib/twin.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const initialNodes: Node[] = [
  { id: "1", type: "input", position: { x: 40, y: 100 }, data: { topic: "plant/a/pipe-03/temp" } },
  { id: "2", type: "condition", position: { x: 320, y: 100 }, data: { op: ">", value: 45 } },
  { id: "3", type: "bimMap", position: { x: 600, y: 60 }, data: { elementId: "IFC-PIPE-003" } },
  { id: "4", type: "action", position: { x: 900, y: 100 }, data: { channel: "LINE", message: "Pipe temperature exceeded threshold" } },
];
const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
];

let idCounter = 5;

export function WorkflowEngine() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const notifications = useDigitalTwinStore((s) => s.notifications);
  const setAlert = useDigitalTwinStore((s) => s.setAlert);
  const pushNotification = useDigitalTwinStore((s) => s.pushNotification);
  const mqtt = useDigitalTwinStore((s) => s.mqttLiveData);
  const workflowActive = useDigitalTwinStore((s) => s.workflowActive);

  const { user } = useAuth();
  const fetchConfig = useServerFn(getWorkflowConfig);
  const saveConfig = useServerFn(saveWorkflowConfig);
  const hydratedFor = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true); // skip until after hydration
  const projectId = useDigitalTwinStore((s) => s.activeProjectId);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, animated: true }, es)), [setEdges]);

  const updateNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  // Inject onChange handler into every node
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, onChange: updateNodeData } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateNodeData]);

  // Load saved workflow from the cloud once per signed-in user.
  useEffect(() => {
    if (!user || !projectId) return;
    const key = `${user.id}:${projectId}`;
    if (hydratedFor.current === key) return;
    skipSave.current = true;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchConfig({ data: { projectId } });
        if (cancelled || !cfg) {
          hydratedFor.current = key;
          skipSave.current = false;
          return;
        }
        // Restore nodes/edges; re-inject onChange handler in next effect.
        const loadedNodes = (cfg.nodes as unknown as Node[]).map((n) => ({ ...n }));
        const loadedEdges = (cfg.edges as unknown as Edge[]).map((e) => ({ ...e }));
        // bump id counter past any restored numeric ids to avoid collisions
        loadedNodes.forEach((n) => {
          const asNum = Number(n.id);
          if (Number.isFinite(asNum) && asNum >= idCounter) idCounter = asNum + 1;
        });
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        hydratedFor.current = key;
        // Allow saves on the next change after a tick so hydration doesn't
        // immediately trigger a re-save.
        setTimeout(() => {
          skipSave.current = false;
        }, 0);
      } catch (err) {
        console.error("Failed to load workflow", err);
        hydratedFor.current = key;
        skipSave.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, projectId, fetchConfig, setNodes, setEdges]);

  // Debounced auto-save whenever nodes/edges change.
  useEffect(() => {
    if (!user || !projectId || skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Strip non-serializable handler before saving.
      const cleanNodes = nodes.map((n) => {
        const { onChange: _omit, ...rest } = (n.data ?? {}) as Record<string, unknown>;
        void _omit;
        return { ...n, data: rest };
      });
      saveConfig({ data: { projectId, nodes: cleanNodes, edges } }).catch((err: unknown) => {
        console.error("Save workflow failed", err);
        toast.error("Couldn't save workflow");
      });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges, user, projectId, saveConfig]);

  // Threshold evaluation loop
  const lastFired = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!workflowActive) return;
    // Walk edges from input → condition → (bimMap?) → action
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    const outgoing = new Map<string, string[]>();
    edges.forEach((e) => {
      const arr = outgoing.get(e.source) ?? [];
      arr.push(e.target);
      outgoing.set(e.source, arr);
    });

    nodes.filter((n) => n.type === "input").forEach((input) => {
      const topic = input.data.topic as string | undefined;
      if (!topic) return;
      const reading = mqtt[topic];
      if (!reading) return;

      const condIds = outgoing.get(input.id) ?? [];
      condIds.forEach((cid) => {
        const cond = byId.get(cid);
        if (!cond || cond.type !== "condition") return;
        const op = cond.data.op as string;
        const threshold = cond.data.value as number;
        if (typeof threshold !== "number") return;
        const v = reading.value;
        const breach =
          (op === ">" && v > threshold) ||
          (op === "<" && v < threshold) ||
          (op === ">=" && v >= threshold) ||
          (op === "<=" && v <= threshold);

        const downstream = outgoing.get(cid) ?? [];
        // resolve target action + optional bim element id
        let elementId: string | undefined;
        const actionNodes: Node[] = [];
        downstream.forEach((nid) => {
          const n = byId.get(nid);
          if (!n) return;
          if (n.type === "bimMap") {
            elementId = n.data.elementId as string | undefined;
            (outgoing.get(nid) ?? []).forEach((aid) => {
              const a = byId.get(aid);
              if (a?.type === "action") actionNodes.push(a);
            });
          } else if (n.type === "action") {
            actionNodes.push(n);
          }
        });

        const alertKey = elementId ?? topic;
        if (breach) {
          setAlert(alertKey, {
            level: "critical",
            message: `${topic} = ${v}${reading.unit} (${op} ${threshold})`,
            at: Date.now(),
          });
          // throttle notifications to 15s per workflow path
          const fireKey = `${input.id}-${cid}`;
          if (!lastFired.current[fireKey] || Date.now() - lastFired.current[fireKey] > 15000) {
            lastFired.current[fireKey] = Date.now();
            actionNodes.forEach((a) => {
              const channel = (a.data.channel as string) ?? "LINE";
              const message =
                (a.data.message as string) ?? `Threshold breach on ${topic}`;
              pushNotification(channel, `${message} — ${topic}=${v}${reading.unit}${elementId ? ` [${elementId}]` : ""}`);
            });
          }
        } else {
          setAlert(alertKey, null);
        }
      });
    });
  }, [mqtt, nodes, edges, setAlert, pushNotification, workflowActive]);

  const addNode = (type: keyof typeof nodeTypes) => {
    const id = String(idCounter++);
    const defaults: Record<string, Record<string, unknown>> = {
      input: { topic: "" },
      condition: { op: ">", value: 0 },
      bimMap: { elementId: "" },
      action: { channel: "LINE", message: "" },
    };
    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        position: { x: 200 + Math.random() * 300, y: 250 + Math.random() * 150 },
        data: { ...defaults[type], onChange: updateNodeData },
      },
    ]);
  };

  return (
    <div className="flex h-full w-full">
      <div className="relative flex-1">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
          <ToolbarBtn onClick={() => addNode("input")} icon={<Radio className="h-3.5 w-3.5" />} label="Input" />
          <ToolbarBtn onClick={() => addNode("condition")} icon={<Filter className="h-3.5 w-3.5" />} label="Threshold" />
          <ToolbarBtn onClick={() => addNode("bimMap")} icon={<Box className="h-3.5 w-3.5" />} label="BIM Map" />
          <ToolbarBtn onClick={() => addNode("action")} icon={<Send className="h-3.5 w-3.5" />} label="Action" />
          <div className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            {user ? <Cloud className="h-3 w-3 text-[hsl(var(--success))]" /> : <CloudOff className="h-3 w-3" />}
            {user ? "Auto-saving" : "Sign in to sync"}
          </div>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="hsl(var(--border))" gap={16} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      <aside className="w-80 shrink-0 border-l border-border bg-card overflow-auto">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notification Log</h3>
          <p className="text-xs text-muted-foreground">Mock LINE / Telegram pushes</p>
        </div>
        <div className="p-3 space-y-2">
          {notifications.length === 0 && (
            <p className="text-xs text-muted-foreground">No alerts fired yet. Trigger a threshold from live MQTT data.</p>
          )}
          {notifications.map((n) => (
            <div key={n.id} className="rounded border border-border bg-background p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{n.channel}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(n.ts).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1">{n.text}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ToolbarBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-xs font-medium backdrop-blur hover:bg-accent hover:text-accent-foreground"
    >
      <Plus className="h-3 w-3" />
      {icon}
      {label}
    </button>
  );
}