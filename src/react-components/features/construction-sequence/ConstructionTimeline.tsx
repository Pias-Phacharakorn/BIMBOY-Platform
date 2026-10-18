/**
 * The 4D timeline, floating over the viewport just above the bottom toolbar: Play/Pause, a slider
 * from month 0 to the Schedule's last month in steps of 0.1, and the current month.
 */

import { Pause, Play } from "lucide-react";
import type { ConstructionSequenceTab } from "./useConstructionSequence";

export function ConstructionTimeline({ tab }: { tab: ConstructionSequenceTab }) {
  const { schedule, month, isPlaying } = tab;
  if (!schedule || month === null) return null;

  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 w-[min(720px,calc(100%-24px))] px-3 py-2 border border-border bg-surface/94 rounded-[14px] backdrop-blur-md"
      data-testid="cs-timeline"
    >
      <button
        type="button"
        onClick={tab.togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        data-testid="cs-play"
        data-playing={isPlaying}
        className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-radius border border-border-strong text-fg cursor-pointer transition-colors duration-120 hover:bg-surface-alt"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <input
        type="range"
        min={0}
        max={schedule.months}
        step={0.1}
        value={month}
        onChange={(event) => tab.scrubTo(Number(event.target.value))}
        aria-label="Construction month"
        data-testid="cs-slider"
        className="flex-1 accent-accent cursor-pointer"
      />
      <span className="shrink-0 w-24 text-right text-xs font-semibold tabular-nums text-fg" data-testid="cs-month">
        Month {month.toFixed(1)} / {schedule.months}
      </span>
    </div>
  );
}
