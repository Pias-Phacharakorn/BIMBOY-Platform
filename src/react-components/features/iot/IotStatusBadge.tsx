/**
 * Status as a dot **plus a word**.
 *
 * The word is not decoration. Running the `dataviz` validator over this project's status tokens
 * against the dark chart surface measured the green↔amber pair at **ΔE 5.3 under protanopia**
 * (normal vision 18.4) — below even the 6–8 floor band. A coloured dot alone is genuinely
 * unreadable for protan users trying to tell healthy from warning, so colour here is a
 * reinforcement of the label, never the carrier of the state.
 */

import type { DeviceStatus } from "./iotTypes";

const PRESENTATION: Record<DeviceStatus, { label: string; dot: string; text: string }> = {
  alarm: { label: "Alarm", dot: "bg-status-danger", text: "text-status-danger" },
  warn: { label: "Warning", dot: "bg-status-warn", text: "text-status-warn" },
  ok: { label: "OK", dot: "bg-status-ok", text: "text-muted" },
  // Offline is hollow as well as grey: a filled dot reads as "reporting something".
  offline: { label: "Offline", dot: "bg-transparent border border-muted-2", text: "text-muted-2" },
};

export function IotStatusBadge({ status }: { status: DeviceStatus }) {
  const { label, dot, text } = PRESENTATION[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${text}`}>{label}</span>
    </span>
  );
}
