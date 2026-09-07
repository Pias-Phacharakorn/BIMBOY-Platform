/**
 * The IOT tab's right panel: the selected device's identity, status, charts, and — for admins —
 * the controls to correct or remove it.
 *
 * The panel must be **self-describing**: once the camera has flown, the user is looking at geometry
 * and needs the panel to say without ambiguity which device it describes.
 */

import { useState } from "react";
import { Icon } from "@/react-components/components/ui";
import { IotSparkline } from "./IotSparkline";
import { IotStatusBadge } from "./IotStatusBadge";
import { METRICS } from "./iotThresholds";
import { ALL_METRICS, type Metric, type Reading } from "./iotTypes";
import type { IotDeviceRow } from "./useIotDevices";

interface IotDataPanelProps {
  row: IotDeviceRow | null;
  history: ReadonlyMap<Metric, Reading[]>;
  canEdit: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  editError: string | null;
  onSave: (input: { label: string; metrics: Metric[]; deviceCode: string }) => Promise<boolean>;
  onDelete: () => Promise<void>;
}

export function IotDataPanel({ row, ...rest }: IotDataPanelProps) {
  if (!row) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center h-full">
        <Icon name="IOT" size={28} className="text-muted/40" />
        <p className="text-xs text-muted">
          Select a device to see its recent readings and fly the camera to it.
        </p>
      </div>
    );
  }

  // Keyed by the device, so selecting another one remounts with edit mode and any pending delete
  // confirmation cleared — React's idiom for state that belongs to a prop, instead of resetting it
  // from an effect. Without it, one device's unsaved edits could be applied to the next.
  return <DevicePanelBody key={row.device.id} row={row} {...rest} />;
}

type DevicePanelBodyProps = Omit<IotDataPanelProps, "row"> & { row: IotDeviceRow };

function DevicePanelBody({
  row,
  history,
  canEdit,
  isSaving,
  isDeleting,
  editError,
  onSave,
  onDelete,
}: DevicePanelBodyProps) {
  const { device } = row;
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [label, setLabel] = useState(device.label);
  const [deviceCode, setDeviceCode] = useState(device.deviceCode ?? "");
  const [metrics, setMetrics] = useState<Metric[]>([...device.metrics]);

  // Re-seeds from the device even though the component is keyed: after a save the row has new
  // values, and after a cancel the local state still holds the abandoned edit.
  const startEditing = () => {
    setLabel(device.label);
    setDeviceCode(device.deviceCode ?? "");
    setMetrics([...device.metrics]);
    setIsEditing(true);
  };

  const toggleMetric = (metric: Metric) => {
    setMetrics((current) =>
      current.includes(metric) ? current.filter((m) => m !== metric) : [...current, metric],
    );
  };

  const canSubmit = label.trim().length > 0 && metrics.length > 0 && !isSaving;

  return (
    <div
      className="flex flex-col gap-3 p-3 overflow-y-auto"
      data-testid="iot-data-panel"
      data-device-id={device.id}
    >
      <header className="flex flex-col gap-1.5 pb-3 border-b border-border">
        <h3 className="text-sm font-bold text-fg">{device.label}</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-2">
            {device.deviceCode || device.elementCategory || "—"}
          </span>
          <IotStatusBadge status={row.status} />
        </div>
        <span className="text-[10px] text-muted-2">
          Last seen {new Date(row.lastSeen).toLocaleString()}
        </span>
        {!row.locatable && (
          <span className="text-[10px] text-status-warn">
            This device's element is not in a loaded model, so the camera cannot locate it.
          </span>
        )}

        {canEdit && !isEditing && (
          <div className="flex gap-1.5 mt-1">
            <button
              type="button"
              onClick={startEditing}
              data-testid="iot-edit"
              className="px-2 py-1 text-[10px] font-semibold rounded-radius-sm border border-border text-muted hover:text-fg hover:border-border-strong cursor-pointer transition-colors duration-120"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              data-testid="iot-delete"
              className="px-2 py-1 text-[10px] font-semibold rounded-radius-sm border border-border text-status-danger hover:border-status-danger cursor-pointer transition-colors duration-120"
            >
              Delete
            </button>
          </div>
        )}
      </header>

      {/* In-page confirmation, never a browser dialog: a native confirm() blocks the automation
          this project tests with, and would freeze the whole session. */}
      {confirmingDelete && (
        <div className="flex flex-col gap-2 p-3 border border-status-danger/40 rounded-radius bg-status-danger/5">
          <p className="text-[11px] text-fg">
            Delete <span className="font-semibold">{device.label}</span>? This cannot be undone.
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={isDeleting}
              data-testid="iot-delete-confirm"
              className="px-2.5 py-1 text-[10px] font-semibold rounded-radius-sm border border-status-danger bg-status-danger/10 text-status-danger cursor-pointer disabled:opacity-40"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-2.5 py-1 text-[10px] font-semibold rounded-radius-sm border border-border text-muted hover:text-fg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Name</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              data-testid="iot-edit-label"
              className="w-full px-2 py-1.5 text-xs bg-bg border border-border rounded-radius text-fg focus:border-accent focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Device code
            </span>
            <input
              value={deviceCode}
              onChange={(event) => setDeviceCode(event.target.value)}
              placeholder="e.g. ENV-3F-03"
              className="w-full px-2 py-1.5 text-xs bg-bg border border-border rounded-radius text-fg placeholder:text-muted-2 focus:border-accent focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {ALL_METRICS.map((metric) => {
              const active = metrics.includes(metric);
              return (
                <button
                  key={metric}
                  type="button"
                  onClick={() => toggleMetric(metric)}
                  aria-pressed={active}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-radius-sm border cursor-pointer transition-colors duration-120 ${
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

          {editError && (
            <p className="text-[10px] text-status-danger" role="alert">
              {editError}
            </p>
          )}

          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!canSubmit}
              data-testid="iot-edit-save"
              onClick={() => {
                void onSave({ label, metrics, deviceCode }).then((ok) => {
                  if (ok) setIsEditing(false);
                });
              }}
              className="px-2.5 py-1 text-[10px] font-semibold rounded-radius-sm border border-border-strong bg-surface-alt text-fg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-[10px] font-semibold rounded-radius-sm border border-border text-muted hover:text-fg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : !row.online ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center border border-border rounded-radius bg-surface">
          <Icon name="WARNING" size={24} className="text-muted-2" />
          {/* No charts and no numbers for an offline device: fabricating a plot for a sensor that
              is not reporting is the same lie as showing its value as zero. */}
          <p className="text-xs text-muted">This device is offline. No readings are available.</p>
        </div>
      ) : (
        device.metrics.map((metric) => (
          <IotSparkline key={metric} metric={metric} readings={history.get(metric) ?? []} />
        ))
      )}
    </div>
  );
}
