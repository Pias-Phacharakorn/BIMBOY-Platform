import { cn } from "@/lib/utils";

interface Segment {
  key: string;
  value: number;
  color: string;
}

interface WorkloadProgressBarProps {
  percent: number;
  className?: string;
  segments?: Segment[];
}

const WorkloadProgressBar = ({ percent, className, segments }: WorkloadProgressBarProps) => {
  const totalValue = segments ? segments.reduce((s, seg) => s + seg.value, 0) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden flex">
        {segments && totalValue > 0 ? (
          segments.filter(s => s.value > 0).map(seg => (
            <div
              key={seg.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.min((seg.value / 40) * 100, 100)}%`,
                backgroundColor: seg.color,
              }}
            />
          ))
        ) : (
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        )}
      </div>
      <span className={cn(
        "text-xs font-semibold tabular-nums min-w-[3rem] text-right",
        percent > 100 ? "text-destructive" : percent >= 60 ? "text-foreground" : "text-muted-foreground"
      )}>
        {Math.round(percent)}%
      </span>
    </div>
  );
};

export default WorkloadProgressBar;
