import { cn } from "@/lib/utils";
import { ClashStatus, ClashPriority, DISCIPLINES, STATUS_OPTIONS, PRIORITY_OPTIONS, STATUS_COLORS, PRIORITY_COLORS, DISC_COLORS } from "./clashTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  statusFilters: Set<ClashStatus>;
  setStatusFilters: (s: Set<ClashStatus>) => void;
  priorityFilters: Set<ClashPriority>;
  setPriorityFilters: (s: Set<ClashPriority>) => void;
  disciplineFilters: Set<string>;
  setDisciplineFilters: (s: Set<string>) => void;
  zones: string[];
  zoneFilters: Set<string>;
  setZoneFilters: (s: Set<string>) => void;
  dateFrom: string;
  setDateFrom: (s: string) => void;
  dateTo: string;
  setDateTo: (s: string) => void;
  overdueOnly: boolean;
  setOverdueOnly: (b: boolean) => void;
}

const Chip = ({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
      active ? "text-white border-transparent" : "bg-background text-foreground border-border hover:bg-muted"
    )}
    style={active ? { backgroundColor: color } : undefined}
  >
    {label}
  </button>
);

const ClashSlicers = (p: Props) => {
  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n);
  };
  const hasAny = p.statusFilters.size || p.priorityFilters.size || p.disciplineFilters.size || p.zoneFilters.size || p.overdueOnly || p.dateFrom || p.dateTo;

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border">
      <Row label="STATUS">
        {STATUS_OPTIONS.map((s) => (
          <Chip key={s} label={s} active={p.statusFilters.has(s)} color={STATUS_COLORS[s]} onClick={() => toggle(p.statusFilters, s, p.setStatusFilters as any)} />
        ))}
      </Row>
      <Row label="PRIORITY">
        {PRIORITY_OPTIONS.map((s) => (
          <Chip key={s} label={s} active={p.priorityFilters.has(s)} color={PRIORITY_COLORS[s]} onClick={() => toggle(p.priorityFilters, s, p.setPriorityFilters as any)} />
        ))}
      </Row>
      <Row label="DISCIPLINE">
        {DISCIPLINES.map((d) => (
          <Chip key={d} label={d} active={p.disciplineFilters.has(d)} color={DISC_COLORS[d]} onClick={() => toggle(p.disciplineFilters, d, p.setDisciplineFilters as any)} />
        ))}
      </Row>
      {p.zones.length > 0 && (
        <Row label="ZONE">
          {p.zones.map((z) => (
            <Chip key={z} label={z} active={p.zoneFilters.has(z)} color="#475569" onClick={() => toggle(p.zoneFilters, z, p.setZoneFilters as any)} />
          ))}
        </Row>
      )}
      <Row label="CREATED">
        <div className="flex items-center gap-2">
          <Input type="date" value={p.dateFrom} onChange={(e) => p.setDateFrom(e.target.value)} className="h-8 w-40" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={p.dateTo} onChange={(e) => p.setDateTo(e.target.value)} className="h-8 w-40" />
        </div>
      </Row>
      <Row label="OVERDUE">
        <Chip label="⏰ Overdue Only" active={p.overdueOnly} color="#DC2626" onClick={() => p.setOverdueOnly(!p.overdueOnly)} />
        {hasAny && (
          <Button variant="ghost" size="sm" onClick={() => {
            p.setStatusFilters(new Set()); p.setPriorityFilters(new Set()); p.setDisciplineFilters(new Set());
            p.setZoneFilters(new Set()); p.setOverdueOnly(false); p.setDateFrom(""); p.setDateTo("");
          }}>
            <X className="h-3 w-3 mr-1" /> Clear all
          </Button>
        )}
      </Row>
    </div>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">{label}</div>
    <div className="flex flex-wrap gap-2 items-center">{children}</div>
  </div>
);

export default ClashSlicers;
