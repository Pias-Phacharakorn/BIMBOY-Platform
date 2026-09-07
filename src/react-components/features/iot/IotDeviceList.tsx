/**
 * The IOT tab's left panel: every device in the project, worst-first, click to fly the camera to it.
 *
 * **Every device is listed, always** — including ones whose model is not loaded. Hiding those would
 * make the list under-report what is configured: a user who bound twenty devices and sees six
 * concludes the data is gone, and tries to create them again against elements they cannot see.
 * → `CONTEXT.md` § *IOT phase 2*, decision 7.
 */

import { Icon } from "@/react-components/components/ui";
import { useUIStore } from "@/react-components/store/uiStore";
import { IotStatusBadge } from "./IotStatusBadge";
import { METRICS, formatValue, headlineReading } from "./iotThresholds";
import type { IotDeviceRow } from "./useIotDevices";

interface IotDeviceListProps {
  rows: IotDeviceRow[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
  isLoading: boolean;
  isEmpty: boolean;
  error: unknown;
  canBind: boolean;
}

function relativeAge(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function IotDeviceList({
  rows,
  selectedDeviceId,
  onSelect,
  isLoading,
  isEmpty,
  error,
  canBind,
}: IotDeviceListProps) {
  const chipsVisible = useUIStore((state) => state.iotChipsVisible);
  const setChipsVisible = useUIStore((state) => state.setIotChipsVisible);

  /**
   * The escape hatch for the floating chips. They cannot be occluded, so one will eventually sit
   * on an element the user needs to pick, and a single click cannot mean both "select this device"
   * and "pick what is behind it". → `CONTEXT.md` § *IOT phase 3*, decisions 2 and 5.
   */
  const chipToggle = (
    <label className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer select-none hover:bg-surface-alt transition-colors duration-120">
      <input
        type="checkbox"
        checked={chipsVisible}
        onChange={(event) => setChipsVisible(event.target.checked)}
        data-testid="iot-chip-toggle"
        className="w-3.5 h-3.5 accent-accent cursor-pointer"
      />
      <span className="text-[11px] font-semibold text-muted">Show readings on model</span>
    </label>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <Icon name="WARNING" size={24} className="text-status-danger" />
        <p className="text-xs text-muted">Could not load devices for this project.</p>
      </div>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-6">
        <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
        <span className="text-xs text-muted">Loading devices...</span>
      </div>
    );
  }

  // "No devices yet" — not "no model loaded". Devices are project data; a project that has never
  // configured IoT is legitimately empty, and saying so is the point.
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center" data-testid="iot-empty">
        <Icon name="IOT" size={28} className="text-muted/40" />
        <p className="text-xs font-semibold text-fg">No IoT devices yet</p>
        <p className="text-[11px] text-muted">
          {canBind
            ? "Select an element in the model, then bind it as a device above."
            : "A project admin can bind model elements as IoT devices."}
        </p>
      </div>
    );
  }

  return (
    <>
      {chipToggle}
      <ul className="flex flex-col" data-testid="iot-device-list">
      {rows.map((row) => {
        const reading = headlineReading(row.readings);
        const isSelected = row.device.id === selectedDeviceId;
        // Device code when the real system's identifier is known, element category otherwise. The
        // row's own uuid is never shown — it means nothing to a person.
        const subtitle = row.device.deviceCode || row.device.elementCategory || "—";

        return (
          <li key={row.device.id}>
            <button
              type="button"
              onClick={() => onSelect(row.device.id)}
              aria-current={isSelected}
              data-testid="iot-device-row"
              data-device-id={row.device.id}
              data-status={row.status}
              data-locatable={row.locatable}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border cursor-pointer transition-colors duration-120 ${
                isSelected ? "bg-accent-muted" : "hover:bg-surface-alt"
              }`}
            >
              <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                <span className="text-xs font-semibold text-fg truncate">{row.device.label}</span>
                <span className="text-[10px] text-muted-2 truncate">{subtitle}</span>
              </span>

              <span className="flex flex-col items-end gap-0.5 shrink-0">
                {row.online && reading ? (
                  <span className="flex items-baseline gap-1">
                    <span
                      className="text-xs font-semibold tabular-nums text-fg"
                      data-testid="iot-row-value"
                    >
                      {formatValue(reading.metric, reading.value)}
                    </span>
                    <span className="text-[10px] text-muted">{METRICS[reading.metric].unit}</span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-2" data-testid="iot-no-value">
                    --
                  </span>
                )}
                <IotStatusBadge status={row.status} />
              </span>
            </button>

            {(!row.online || !row.locatable) && (
              <p className="px-3 pb-2 -mt-1 flex flex-col gap-0.5">
                {!row.online && (
                  <span className="text-[10px] text-muted-2">
                    Last seen {relativeAge(row.lastSeen)}
                  </span>
                )}
                {/* Says why the camera will not move, rather than leaving a dead click. */}
                {!row.locatable && (
                  <span className="text-[10px] text-status-warn" data-testid="iot-unlocatable">
                    Not in a loaded model — load it to locate this device
                  </span>
                )}
              </p>
            )}
          </li>
          );
        })}
      </ul>
    </>
  );
}
