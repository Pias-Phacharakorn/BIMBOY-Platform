/**
 * One metric's recent history, as a small single-series line chart.
 *
 * Hand-rolled SVG rather than a charting library — see `CONTEXT.md` § *IOT tab*, decision 7. The
 * reason is theming, not bundle size: libraries render their own SVG with inline `fill`/`stroke`,
 * so every axis and grid line becomes a design token threaded through a prop, against the hard
 * constraints banning `!important` and raw `oklch()` in JSX. Here a Tailwind token class applies
 * directly.
 *
 * Built against the `dataviz` skill. What it changed:
 * - **No legend.** One series per chart, so the title names it and a legend box would be noise.
 * - **Values wear ink tokens**, never the series colour; the coloured threshold band and the
 *   status label beside the value carry state.
 * - **A hover layer ships by default** on a line chart — the readout swaps to the hovered sample,
 *   so a spike can be read exactly rather than estimated off the axis.
 * - **Selective labels only** — the current value and the threshold, never a number per point.
 */

import { useMemo, useRef, useState } from "react";
import { METRICS, formatValue, statusFor } from "./iotThresholds";
import type { Metric, Reading } from "./iotTypes";

/** Plot geometry, in viewBox units. Scaled non-uniformly to the panel width. */
const VIEW_W = 240;
const VIEW_H = 56;
/** Keeps the 2px stroke and the end marker clear of the clip edges. */
const PAD_Y = 5;

interface IotSparklineProps {
  metric: Metric;
  readings: readonly Reading[];
}

/** Chart floor/ceiling: the metric's documented domain, widened if the data leaves it. */
function domainFor(metric: Metric, values: readonly number[]): [number, number] {
  const [floor, ceiling] = METRICS[metric].domain;
  let min = floor;
  let max = ceiling;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  // A degenerate domain would divide by zero and collapse the plot onto one line.
  if (max - min < 1e-6) {
    min -= 0.5;
    max += 0.5;
  }
  return [min, max];
}

export function IotSparkline({ metric, readings }: IotSparklineProps) {
  const meta = METRICS[metric];
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = useMemo(() => readings.map((reading) => reading.value), [readings]);
  const [min, max] = useMemo(() => domainFor(metric, values), [metric, values]);

  const toY = (value: number) =>
    VIEW_H - PAD_Y - ((value - min) / (max - min)) * (VIEW_H - PAD_Y * 2);
  const toX = (index: number) =>
    values.length <= 1 ? VIEW_W : (index / (values.length - 1)) * VIEW_W;

  const path = useMemo(() => {
    if (values.length === 0) return "";
    return values
      .map((value, index) => `${index === 0 ? "M" : "L"}${toX(index).toFixed(2)},${toY(value).toFixed(2)}`)
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, min, max]);

  const latest = values.length > 0 ? values[values.length - 1] : null;
  const shown = hoverIndex !== null && hoverIndex < values.length ? values[hoverIndex] : latest;
  const shownReading =
    hoverIndex !== null && hoverIndex < readings.length
      ? readings[hoverIndex]
      : readings[readings.length - 1];

  const status = shown === null ? "ok" : statusFor(metric, shown);
  const statusText = status === "alarm" ? "Alarm" : status === "warn" ? "Warning" : null;

  // The threshold worth drawing is the alarm line where there is one, otherwise the warning line.
  const threshold = meta.alarm ?? meta.warn;
  const thresholdY = threshold !== null ? toY(threshold) : null;
  const thresholdVisible =
    thresholdY !== null && thresholdY > PAD_Y - 1 && thresholdY < VIEW_H - PAD_Y + 1;

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (values.length === 0) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (values.length - 1));
    setHoverIndex(Math.max(0, Math.min(values.length - 1, index)));
  };

  const strokeClass =
    status === "alarm"
      ? "stroke-status-danger"
      : status === "warn"
        ? "stroke-status-warn"
        : "stroke-accent";

  if (readings.length === 0) {
    return (
      <div className="border border-border rounded-radius bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-fg">{meta.label}</span>
          <span className="text-xs text-muted">No data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-radius bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-fg">{meta.label}</span>
        <span className="flex items-baseline gap-1.5">
          {statusText && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                status === "alarm" ? "text-status-danger" : "text-status-warn"
              }`}
            >
              {statusText}
            </span>
          )}
          {/* Ink token, not the series colour — the label above carries the state. */}
          <span className="text-sm font-semibold tabular-nums text-fg">
            {shown === null ? "--" : formatValue(metric, shown)}
          </span>
          <span className="text-[10px] text-muted">{meta.unit}</span>
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="w-full h-14 overflow-visible cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`${meta.label} over the last ${readings.length} samples, currently ${
          shown === null ? "unavailable" : `${formatValue(metric, shown)} ${meta.unit}`
        }`}
      >
        {/* Threshold band — everything at or beyond the limit, tinted. Drawn first so the series
            sits over it. */}
        {thresholdVisible && (
          <>
            <rect
              x={0}
              y={0}
              width={VIEW_W}
              height={Math.max(0, thresholdY!)}
              className="fill-status-danger/10"
            />
            <line
              x1={0}
              x2={VIEW_W}
              y1={thresholdY!}
              y2={thresholdY!}
              strokeDasharray="3 3"
              className="stroke-status-danger/50"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* The series. `non-scaling-stroke` keeps the 2px weight honest despite the non-uniform
            scale that lets the chart fill any panel width. */}
        <path
          d={path}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={strokeClass}
        />

        {/* Data-end marker: anchors the eye to the newest sample. */}
        {latest !== null && (
          <circle
            cx={toX(values.length - 1)}
            cy={toY(latest)}
            r={2.5}
            className={strokeClass.replace("stroke-", "fill-")}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Hover crosshair. The length guard matches the readouts above: unreachable today, since
            a metric change remounts via `key` and history always returns a full buffer, but a
            shorter series would otherwise put `cy="NaN"` on the marker. */}
        {hoverIndex !== null && hoverIndex < values.length && (
          <>
            <line
              x1={toX(hoverIndex)}
              x2={toX(hoverIndex)}
              y1={0}
              y2={VIEW_H}
              className="stroke-muted/40"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={toX(hoverIndex)}
              cy={toY(values[hoverIndex])}
              r={3}
              className="fill-fg"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-2">
        <span>{readings.length} samples</span>
        {shownReading && (
          <span className="tabular-nums">
            {new Date(shownReading.ts).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
