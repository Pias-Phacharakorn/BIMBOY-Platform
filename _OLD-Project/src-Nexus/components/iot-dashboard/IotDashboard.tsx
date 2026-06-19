import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { KNOWN_TOPICS } from "@/hooks/useMockMqtt";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Thermometer, Droplets, Gauge, Activity, AlertTriangle } from "lucide-react";

const ICONS: Record<string, typeof Thermometer> = {
  temp: Thermometer,
  humidity: Droplets,
  level: Gauge,
  vibration: Activity,
};

function iconFor(topic: string) {
  const key = Object.keys(ICONS).find((k) => topic.includes(k));
  return ICONS[key ?? "temp"];
}

function label(topic: string) {
  const parts = topic.split("/");
  return parts.slice(-2).join(" · ");
}

export function IotDashboard() {
  const mqtt = useDigitalTwinStore((s) => s.mqttLiveData);
  const alerts = useDigitalTwinStore((s) => s.alertStates);
  const model = useDigitalTwinStore((s) => s.activeIfcModel);
  const selectElement = useDigitalTwinStore((s) => s.selectElement);
  const bimActive = useDigitalTwinStore((s) => s.bimActive);

  const topicToElement = new Map<string, string>();
  model?.elements.forEach((e) => e.mqttTopic && topicToElement.set(e.mqttTopic, e.id));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">IoT Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live MQTT metrics · {KNOWN_TOPICS.length} topics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {KNOWN_TOPICS.map((topic) => {
          const data = mqtt[topic];
          const Icon = iconFor(topic);
          const linkedElement = topicToElement.get(topic);
          const alertKey = linkedElement ?? topic;
          const alert = alerts[alertKey];
          return (
            <button
              key={topic}
              onClick={() => {
                if (bimActive && linkedElement) selectElement(linkedElement);
              }}
              className={`group rounded-lg border bg-card p-4 text-left transition-all hover:shadow-md ${
                alert ? "border-destructive/60 ring-2 ring-destructive/20" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                  alert ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                {alert && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </div>
              <p className="mt-3 text-xs text-muted-foreground capitalize">{label(topic)}</p>
              <p className="text-2xl font-bold">
                {data ? data.value : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{data?.unit}</span>
              </p>
              {linkedElement && (
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">→ {linkedElement}</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {KNOWN_TOPICS.slice(0, 4).map((topic) => {
          const data = mqtt[topic];
          return (
            <div key={topic} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{label(topic)}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{topic}</p>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.history.map((h) => ({ t: new Date(h.t).toLocaleTimeString(), v: h.v })) ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                    <Line type="monotone" dataKey="v" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}