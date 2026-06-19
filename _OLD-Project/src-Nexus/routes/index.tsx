import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Box, Activity, Workflow, ArrowRight, Cpu, Bell } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <AppLayout>
      <Index />
    </AppLayout>
  ),
});

function Index() {
  const { bimActive, iotActive, workflowActive, mqttLiveData, alertStates, notifications } = useDigitalTwinStore();
  const modules = [
    { key: "bim", label: "BIM IFC Viewer", desc: "3D model + element properties", icon: Box, href: "/bim", active: bimActive },
    { key: "iot", label: "IoT Dashboard", desc: "Live MQTT metrics & charts", icon: Activity, href: "/iot", active: iotActive },
    { key: "wf", label: "Workflow Engine", desc: "Thresholds → LINE / Telegram", icon: Workflow, href: "/workflow", active: workflowActive },
  ];
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Digital Twin Overview</h1>
        <p className="text-sm text-muted-foreground">Three modular subsystems. Toggle them independently from the sidebar.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={Cpu} label="Live MQTT topics" value={Object.keys(mqttLiveData).length} />
        <Stat icon={Bell} label="Active alerts" value={Object.keys(alertStates).length} tone="destructive" />
        <Stat icon={Workflow} label="Notifications sent" value={notifications.length} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modules.map((m) => (
          <Link
            key={m.key}
            to={m.href}
            className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-accent hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent">
                <m.icon className="h-5 w-5" />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  m.active ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" : "bg-muted text-muted-foreground"
                }`}
              >
                {m.active ? "ACTIVE" : "DISABLED"}
              </span>
            </div>
            <h3 className="mt-4 font-semibold">{m.label}</h3>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-accent">
              Open <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Box; label: string; value: number; tone?: "destructive" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone === "destructive" && value > 0 ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
