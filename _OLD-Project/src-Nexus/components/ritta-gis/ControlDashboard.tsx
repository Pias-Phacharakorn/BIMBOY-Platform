import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Users,
  Briefcase,
  TrendingUp,
  ShieldCheck,
  CloudSun,
  FileWarning,
} from "lucide-react";
import type { LiveAlert, RittaProject } from "@/types/project";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  HeadOffice: "#22d3ee",
  Warehouse: "#0ea5e9",
  Factory: "#a78bfa",
  Infrastructure: "#34d399",
  Commercial: "#f59e0b",
  Residential: "#f472b6",
  Energy: "#ef4444",
};

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-cyan-500/30 bg-slate-950/60 backdrop-blur-md shadow-[0_0_18px_rgba(6,182,212,0.12)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-cyan-500/20 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-mono text-cyan-300/90">
          {title}
        </span>
        <span className="h-1 w-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  trend,
  accent = "text-cyan-300",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  trend?: number[];
  accent?: string;
}) {
  const data = (trend ?? []).map((v, i) => ({ i, v }));
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-slate-700/50 bg-slate-900/40 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent)} />
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-slate-400">{label}</span>
          <span className={cn("text-base font-mono font-semibold tabular-nums", accent)}>
            {value}
          </span>
        </div>
      </div>
      {data.length > 0 && (
        <div className="h-7 w-20">
          <ResponsiveContainer>
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="#22d3ee"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── LEFT — macro analytics ───────────────────────── */

export function LeftDashboard({
  projects,
  alerts,
  onAlertClick,
}: {
  projects: RittaProject[];
  alerts: LiveAlert[];
  onAlertClick: (projectId: string) => void;
}) {
  const fleetValue = useMemo(
    () => projects.reduce((s, p) => s + p.projectValueUSD, 0),
    [projects],
  );
  const workforce = useMemo(
    () => projects.reduce((s, p) => s + p.kpiMetrics.manpowerActual, 0),
    [projects],
  );
  const avgProgress = useMemo(
    () =>
      Math.round(
        projects.reduce((s, p) => s + p.progressPercentage, 0) /
          Math.max(1, projects.length),
      ),
    [projects],
  );

  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) map.set(p.type, (map.get(p.type) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [projects]);

  return (
    <aside className="pointer-events-auto absolute left-3 top-14 bottom-24 z-20 w-[19rem] flex flex-col gap-3 overflow-y-auto">
      <Panel title="Macro KPIs">
        <div className="space-y-2">
          <Kpi
            icon={Briefcase}
            label="Total Fleet Value"
            value={`$${(fleetValue / 1_000_000).toFixed(1)}M`}
            trend={[3, 4, 4, 5, 5, 6, 7, 8, 9, 10]}
          />
          <Kpi
            icon={Users}
            label="Active Workforce"
            value={workforce.toLocaleString()}
            trend={[6, 7, 5, 6, 8, 9, 8, 10, 11, 12]}
            accent="text-emerald-300"
          />
          <Kpi
            icon={TrendingUp}
            label="Avg Progress Index"
            value={`${avgProgress}%`}
            trend={[2, 3, 4, 5, 5, 6, 7, 7, 8, 9]}
            accent="text-amber-300"
          />
        </div>
      </Panel>

      <Panel title="Project Allocation">
        <div className="h-44 relative">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={distribution}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={66}
                paddingAngle={3}
                stroke="#020617"
              >
                {distribution.map((d) => (
                  <Cell key={d.name} fill={TYPE_COLORS[d.name] ?? "#22d3ee"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "rgba(2,6,23,0.95)",
                  border: "1px solid rgba(6,182,212,0.4)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#e0f2fe",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-mono text-cyan-200 font-semibold">
                {projects.length}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-slate-400">Assets</div>
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          {distribution.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-slate-300">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: TYPE_COLORS[d.name] ?? "#22d3ee" }}
              />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto text-slate-500">{d.value}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Live Incident Ticker" className="flex-1 min-h-[16rem]">
        <div className="space-y-1.5 max-h-full overflow-y-auto pr-1">
          {alerts.map((a) => (
            <button
              key={a.id}
              onClick={() => onAlertClick(a.projectId)}
              className={cn(
                "w-full text-left flex items-start gap-2 rounded-sm border px-2 py-1.5 transition-colors",
                a.severity === "critical"
                  ? "border-red-500/50 bg-red-500/5 hover:bg-red-500/10"
                  : a.severity === "warning"
                    ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                    : "border-slate-600/40 bg-slate-800/30 hover:bg-slate-700/30",
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5 mt-0.5 shrink-0",
                  a.severity === "critical"
                    ? "text-red-400"
                    : a.severity === "warning"
                      ? "text-amber-400"
                      : "text-slate-400",
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-200 leading-snug">{a.message}</div>
                <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                  {new Date(a.at).toLocaleTimeString()} · {a.projectId}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

/* ───────────────────────── RIGHT — micro telemetry ───────────────────────── */

export function RightDashboard({
  project,
  onOpenBim,
}: {
  project: RittaProject | null;
  onOpenBim: () => void;
}) {
  if (!project) {
    return (
      <aside className="pointer-events-auto absolute right-3 top-14 bottom-24 z-20 w-[20rem] flex items-center justify-center">
        <div className="rounded-md border border-cyan-500/30 bg-slate-950/60 backdrop-blur-md p-6 text-center text-xs font-mono text-cyan-300/70 shadow-[0_0_18px_rgba(6,182,212,0.12)]">
          <CloudSun className="h-6 w-6 mx-auto mb-2 text-cyan-400/80" />
          Select a site marker
          <div className="text-slate-500 mt-1">Micro telemetry will appear here</div>
        </div>
      </aside>
    );
  }

  const k = project.kpiMetrics;
  const manpowerPct = k.manpowerTarget
    ? Math.round((k.manpowerActual / k.manpowerTarget) * 100)
    : 0;

  return (
    <aside className="pointer-events-auto absolute right-3 top-14 bottom-24 z-20 w-[20rem] flex flex-col gap-3 overflow-y-auto">
      <Panel title={`Site // ${project.province}`}>
        <div className="text-sm font-semibold text-cyan-100">{project.name}</div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>{project.type}</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-sm border",
              project.status === "Ongoing"
                ? "border-cyan-400/60 text-cyan-300"
                : project.status === "Operational"
                  ? "border-emerald-400/60 text-emerald-300"
                  : project.status === "Bidding"
                    ? "border-amber-400/60 text-amber-300"
                    : "border-slate-500/60 text-slate-400",
            )}
          >
            {project.status}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="rounded-sm bg-slate-900/40 border border-slate-700/50 px-2 py-1.5">
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Value</div>
            <div className="text-cyan-200 text-sm">
              ${(project.projectValueUSD / 1_000_000).toFixed(1)}M
            </div>
          </div>
          <div className="rounded-sm bg-slate-900/40 border border-slate-700/50 px-2 py-1.5">
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Progress</div>
            <div className="text-amber-200 text-sm">{project.progressPercentage}%</div>
          </div>
        </div>
        <button
          onClick={onOpenBim}
          className="mt-3 w-full rounded-sm border border-cyan-400/70 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-cyan-200 transition-colors shadow-[0_0_12px_rgba(6,182,212,0.25)]"
        >
          Show Project · BIM View
        </button>
      </Panel>

      <Panel title="S-Curve Progress">
        <div className="h-32">
          <ResponsiveContainer>
            <AreaChart data={project.sCurve}>
              <defs>
                <linearGradient id="planned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="actual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="2 2" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
                interval={3}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
                width={26}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(2,6,23,0.95)",
                  border: "1px solid rgba(6,182,212,0.4)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#e0f2fe",
                }}
              />
              <Area type="monotone" dataKey="planned" stroke="#0ea5e9" fill="url(#planned)" />
              <Area type="monotone" dataKey="actual" stroke="#22d3ee" fill="url(#actual)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Safety & Manpower">
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="rounded-sm bg-slate-900/40 border border-slate-700/50 px-2 py-2">
            <div className="flex items-center gap-1 text-slate-500 uppercase tracking-widest text-[9px]">
              <ShieldCheck className="h-3 w-3" /> Safety Days
            </div>
            <div className="text-emerald-300 text-base mt-0.5">{k.safetyDays}</div>
          </div>
          <div className="rounded-sm bg-slate-900/40 border border-slate-700/50 px-2 py-2">
            <div className="text-slate-500 uppercase tracking-widest text-[9px]">Risk Mitig.</div>
            <div className="text-cyan-200 text-base mt-0.5">
              {Math.round(k.riskMitigationRate * 100)}%
            </div>
          </div>
          <div className="col-span-2 rounded-sm bg-slate-900/40 border border-slate-700/50 px-2 py-2">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-500">
              <span>Manpower</span>
              <span className="text-cyan-300">
                {k.manpowerActual} / {k.manpowerTarget}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                style={{ width: `${Math.min(100, manpowerPct)}%` }}
              />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="RFI / Issue Status">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: "Open", value: k.openRFIs, color: "text-amber-300", bg: "bg-amber-500/10" },
            {
              label: "Pending",
              value: k.pendingRFIs,
              color: "text-cyan-300",
              bg: "bg-cyan-500/10",
            },
            {
              label: "Resolved",
              value: k.resolvedRFIs,
              color: "text-emerald-300",
              bg: "bg-emerald-500/10",
            },
          ].map((c) => (
            <div
              key={c.label}
              className={cn(
                "rounded-sm border border-slate-700/50 px-2 py-2 font-mono",
                c.bg,
              )}
            >
              <div className={cn("text-lg", c.color)}>{c.value}</div>
              <div className="text-[9px] uppercase tracking-widest text-slate-400 flex items-center justify-center gap-1">
                <FileWarning className="h-2.5 w-2.5" />
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={`Weather · ${project.weather.stationId}`}>
        <div className="flex items-center justify-between font-mono text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-cyan-300" />
            <div>
              <div className="text-base text-cyan-100">{project.weather.tempC}°C</div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500">
                {project.weather.condition}
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-400">
            <div>HUM {project.weather.humidity}%</div>
            <div>WIND {project.weather.windKmh} km/h</div>
          </div>
        </div>
      </Panel>
    </aside>
  );
}