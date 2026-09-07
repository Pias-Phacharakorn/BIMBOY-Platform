/**
 * The bind form: turn the element currently selected in the viewport into a device.
 *
 * Rendered only for project admins. When binding is unavailable it says **why** rather than sitting
 * inert — an inert control teaches the user nothing and they will click it repeatedly.
 */

import { useState } from "react";
import { Icon } from "@/react-components/components/ui";
import { ALL_METRICS, type Metric } from "./iotTypes";
import { METRICS } from "./iotThresholds";
import type { UseIotBinding } from "./useIotBinding";

interface IotBindPanelProps {
  binding: UseIotBinding;
  onBound: () => void;
}

const BLOCKER_MESSAGE: Record<string, string> = {
  "no-selection": "Select one element in the model to bind it as a device.",
  "multi-selection": "Select exactly one element — several are selected.",
  reading: "Reading the selected element…",
  "no-guid": "This element has no IFC GlobalId, so it cannot be bound reliably. Pick another.",
};

export function IotBindPanel({ binding, onBound }: IotBindPanelProps) {
  const { blocker, candidate, existing, isSaving, saveError, save } = binding;

  if (blocker === "already-bound" && existing) {
    return (
      <div className="p-3 border-b border-border bg-surface-alt">
        <p className="text-[11px] text-muted">
          This element is already the device{" "}
          <span className="font-semibold text-fg">{existing.label}</span>.
        </p>
      </div>
    );
  }

  if (blocker) {
    return (
      <div className="p-3 border-b border-border bg-surface-alt">
        <p className="text-[11px] text-muted">{BLOCKER_MESSAGE[blocker] ?? "Cannot bind."}</p>
      </div>
    );
  }

  // Belt and braces: `blocker === null` is supposed to guarantee a candidate, and the hook now
  // derives both from the same selection so it does. Rendering nothing rather than asserting means
  // a future regression in that invariant is a blank panel, not a crashed app — which is how this
  // component previously took the whole page down.
  if (!candidate) return null;

  // Keyed by the element, so selecting a different one remounts the form with fresh values rather
  // than resetting it from an effect — React's own idiom for "this state belongs to that prop".
  return (
    <BindForm
      key={candidate.ifcGuid}
      candidate={candidate}
      isSaving={isSaving}
      saveError={saveError}
      save={save}
      onBound={onBound}
    />
  );
}

interface BindFormProps {
  candidate: NonNullable<UseIotBinding["candidate"]>;
  isSaving: boolean;
  saveError: string | null;
  save: UseIotBinding["save"];
  onBound: () => void;
}

function BindForm({ candidate, isSaving, saveError, save, onBound }: BindFormProps) {
  const [label, setLabel] = useState(candidate.suggestedLabel);
  const [deviceCode, setDeviceCode] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>(["temperature"]);

  const toggleMetric = (metric: Metric) => {
    setMetrics((current) =>
      current.includes(metric) ? current.filter((m) => m !== metric) : [...current, metric],
    );
  };

  const canSave = label.trim().length > 0 && metrics.length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    const ok = await save({ label, metrics, deviceCode });
    if (ok) onBound();
  };

  return (
    <div className="flex flex-col gap-2.5 p-3 border-b border-border bg-surface-alt">
      <div className="flex items-center gap-1.5">
        <Icon name="IOT" size={14} className="text-accent" />
        <span className="text-[11px] font-semibold text-fg">Bind selected element</span>
      </div>

      {candidate.category && (
        <span className="text-[10px] text-muted-2">{candidate.category}</span>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Name</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-bg border border-border rounded-radius text-fg focus:border-accent focus:outline-none"
          data-testid="iot-bind-label"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Device code <span className="font-normal normal-case tracking-normal">(optional)</span>
        </span>
        <input
          value={deviceCode}
          onChange={(event) => setDeviceCode(event.target.value)}
          placeholder="e.g. ENV-3F-03"
          className="w-full px-2 py-1.5 text-xs bg-bg border border-border rounded-radius text-fg placeholder:text-muted-2 focus:border-accent focus:outline-none"
          data-testid="iot-bind-code"
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
          Reports
        </legend>
        <div className="flex flex-wrap gap-1">
          {ALL_METRICS.map((metric) => {
            const active = metrics.includes(metric);
            return (
              <button
                key={metric}
                type="button"
                onClick={() => toggleMetric(metric)}
                aria-pressed={active}
                className={`px-2 py-1 text-[10px] font-semibold rounded-radius-sm border transition-colors duration-120 cursor-pointer ${
                  active
                    ? "border-accent bg-accent-muted text-fg"
                    : "border-border text-muted hover:border-border-strong hover:text-fg"
                }`}
              >
                {METRICS[metric].label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {saveError && (
        <p className="text-[10px] text-status-danger" role="alert">
          {saveError}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!canSave}
        data-testid="iot-bind-save"
        className="w-full px-3 py-1.5 text-xs font-semibold rounded-radius border border-border-strong bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer hover:border-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-120"
      >
        {isSaving ? "Binding…" : "Bind as device"}
      </button>
    </div>
  );
}
