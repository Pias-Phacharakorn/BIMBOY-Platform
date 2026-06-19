import { useEffect, useState } from "react";
import { Globe2, BarChart3, Box, ShieldAlert, Settings, Activity, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export type HudModule = "gis" | "analytics" | "bim" | "safety" | "settings";

interface NavbarHUDProps {
  active: HudModule;
  onSelect: (m: HudModule) => void;
}

const MODULES: { id: HudModule; label: string; icon: typeof Globe2 }[] = [
  { id: "gis", label: "Global GIS", icon: Globe2 },
  { id: "analytics", label: "Project Analytics", icon: BarChart3 },
  { id: "bim", label: "BIM Operational View", icon: Box },
  { id: "safety", label: "Safety Control", icon: ShieldAlert },
  { id: "settings", label: "System Settings", icon: Settings },
];

/**
 * Top HUD bar — slim, glassy, command-center vibe.
 */
export function NavbarHUD({ active, onSelect }: NavbarHUDProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-2 backdrop-blur-md bg-slate-950/60 border-b border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.18)]">
      {/* Left — platform title */}
      <div className="flex items-center gap-3">
        <div className="relative h-7 w-7">
          <div className="absolute inset-0 rounded-sm border border-cyan-400/70" />
          <div className="absolute inset-1 rounded-sm bg-cyan-400/30" />
          <div className="absolute inset-2 rounded-sm bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] tracking-[0.3em] text-cyan-300/80 font-mono">RITTA</span>
          <span className="text-sm font-semibold text-white tracking-wider">
            IOC-MAX <span className="text-cyan-400">//</span> CITY OS
          </span>
        </div>
      </div>

      {/* Center — clock + status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-200/90">
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-300">LINK SECURE</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-mono text-slate-400 tracking-widest">{date}</span>
          <span className="text-xl font-mono font-semibold text-cyan-200 tracking-widest tabular-nums">
            {time}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-200/80">
          <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>NODES 248 / 248</span>
        </div>
      </div>

      {/* Right — module toggles */}
      <div className="flex items-center gap-1">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={cn(
                "group flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-all",
                isActive
                  ? "border-cyan-400/80 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}