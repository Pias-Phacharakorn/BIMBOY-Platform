/**
 * Drives the IOT tab: devices from the database, their resolution against the loaded models, the
 * live tick, the selection and the camera flight.
 *
 * Phase 1's runtime binding walk is gone — devices are authored, so nothing here ever *picks* an
 * element. → `CONTEXT.md` § *IOT phase 2*.
 *
 * **Nothing is cleared by an effect.** Where a value stops applying it is derived away at read time
 * instead, which keeps `react-hooks/set-state-in-effect` satisfied and removes a class of flicker.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "@/react-components/store/bimStore";
import {
  EMPTY_RESOLUTION,
  IotView,
  type ResolutionResult,
  type ResolvedDevice,
} from "@/bim-components/IotView";
import {
  MAX_HISTORY_POINTS,
  mockIotProvider,
  registerDeviceMetrics,
  TICK_MS,
} from "./mockIotProvider";
import { STATUS_ORDER, worstStatus } from "./iotThresholds";
import { useIotDeviceList, useUpdateIotDevice } from "./useIotDeviceQueries";
import type { DeviceStatus, IotDevice, IotProvider, Metric, Reading } from "./iotTypes";

const EMPTY_HISTORY: ReadonlyMap<Metric, Reading[]> = new Map();

export interface IotDeviceRow {
  device: IotDevice;
  status: DeviceStatus;
  /** Latest reading per metric. Empty for an offline device — never a fabricated zero. */
  readings: Reading[];
  online: boolean;
  lastSeen: string;
  /** False when no loaded model contains this device's element, so the camera cannot act. */
  locatable: boolean;
}

interface HistoryState {
  deviceId: string;
  byMetric: ReadonlyMap<Metric, Reading[]>;
}

export interface UseIotDevices {
  rows: IotDeviceRow[];
  selectedDeviceId: string | null;
  selectedRow: IotDeviceRow | null;
  history: ReadonlyMap<Metric, Reading[]>;
  /** deviceId → where its element is, for the chips to anchor to. */
  resolved: ReadonlyMap<string, ResolvedDevice>;
  isLoading: boolean;
  error: unknown;
  /** True once the device list has loaded and is empty — the "not configured yet" state. */
  isEmpty: boolean;
  select: (deviceId: string) => void;
  clearSelection: () => void;
}

export function useIotDevices(
  isActive: boolean,
  projectId: string | undefined,
  provider: IotProvider = mockIotProvider,
): UseIotDevices {
  const { components, world } = useBimStore();

  const {
    data: devices,
    isLoading,
    error,
  } = useIotDeviceList(projectId, isActive);

  const updateDevice = useUpdateIotDevice(projectId);

  const [resolution, setResolution] = useState<ResolutionResult>(EMPTY_RESOLUTION);
  const [latest, setLatest] = useState<Reading[]>([]);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [rawSelectedId, setRawSelectedId] = useState<string | null>(null);
  const [modelTick, setModelTick] = useState(0);

  const deviceList = useMemo(() => devices ?? [], [devices]);

  /** Ownership token for the async resolution round-trip. → ADR-0026. */
  const generationRef = useRef(0);
  useEffect(() => () => void generationRef.current++, []);

  /**
   * The provider is not told which devices exist — it answers telemetry only. Registering their
   * metrics here is what lets it produce readings without knowing anything about BIM or Supabase.
   */
  useEffect(() => {
    for (const device of deviceList) registerDeviceMetrics(device.id, device.metrics);
  }, [deviceList]);

  /** A selection is only real while its device is still in the list. Derived, never cleared. */
  const selectedDeviceId =
    rawSelectedId && deviceList.some((device) => device.id === rawSelectedId)
      ? rawSelectedId
      : null;

  // ─── Resolve stored GUIDs against the loaded models ──────────────────────────
  useEffect(() => {
    if (!isActive || !components || deviceList.length === 0) return;

    const generation = ++generationRef.current;
    const isStale = () => generationRef.current !== generation;

    void (async () => {
      try {
        const result = await components.get(IotView).resolve(deviceList);
        if (isStale()) return;
        setResolution(result);

        // A device found outside its stored hint has the hint corrected, so the next lookup is one
        // query again. Fire-and-forget: a failure here costs a little speed, never correctness.
        for (const [deviceId, modelId] of result.corrections) {
          updateDevice.mutate({ id: deviceId, modelId });
        }
      } catch (err) {
        console.warn("[iot] failed to resolve devices", err);
      }
    })();
    // `updateDevice` is intentionally absent: it is recreated every render and would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, components, deviceList, modelTick]);

  // Re-resolve after models finish loading or unloading — a device's element may have just arrived
  // or just left, which is the difference between locatable and not.
  useEffect(() => {
    if (!isActive || !components) return;

    const fragments = components.get(OBC.FragmentsManager);
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const onModelsChanged = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        setModelTick((tick) => tick + 1);
      }, 400);
    };

    fragments.list.onItemSet.add(onModelsChanged);
    fragments.list.onItemDeleted.add(onModelsChanged);
    return () => {
      if (timeout) clearTimeout(timeout);
      fragments.list.onItemSet.remove(onModelsChanged);
      fragments.list.onItemDeleted.remove(onModelsChanged);
    };
  }, [isActive, components]);

  // ─── Live tick ──────────────────────────────────────────────────────────────
  /**
   * ⚠️ Gated on the tab being **active**, not mounted — `ModelsView` keeps inactive tabs
   * mounted-but-hidden, so a mount-scoped interval would run forever behind every other tab.
   *
   * ⚠️ Touches React state only, never the OBC world. This phase zooms but does not colour
   * geometry, so the tick has no reason to reach the renderer — the boundary that protects
   * ADR-0020's one-render-per-frame.
   */
  useEffect(() => {
    if (!isActive || deviceList.length === 0) return;

    const deviceIds = deviceList.map((device) => device.id);
    let cancelled = false;

    const poll = async () => {
      try {
        const readings = await provider.getLatest(deviceIds);
        if (!cancelled) setLatest(readings);
      } catch (err) {
        console.warn("[iot] failed to read latest values", err);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive, deviceList, provider]);

  // ─── History for the selected device ────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !selectedDeviceId) return;

    const device = deviceList.find((entry) => entry.id === selectedDeviceId);
    if (!device || !provider.isOnline(device.id)) return;

    let cancelled = false;

    const load = async () => {
      const to = new Date();
      const from = new Date(to.getTime() - MAX_HISTORY_POINTS * TICK_MS);
      try {
        const entries = await Promise.all(
          device.metrics.map(
            async (metric) =>
              [metric, await provider.getHistory(device.id, metric, from, to)] as const,
          ),
        );
        if (!cancelled) setHistory({ deviceId: device.id, byMetric: new Map(entries) });
      } catch (err) {
        console.warn("[iot] failed to read history", err);
      }
    };

    void load();
    const interval = setInterval(() => void load(), TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive, selectedDeviceId, deviceList, provider]);

  // ─── Rows ───────────────────────────────────────────────────────────────────
  const rows = useMemo<IotDeviceRow[]>(() => {
    const byDevice = new Map<string, Reading[]>();
    for (const reading of latest) {
      const bucket = byDevice.get(reading.deviceId);
      if (bucket) bucket.push(reading);
      else byDevice.set(reading.deviceId, [reading]);
    }

    return deviceList
      .map((device) => {
        const readings = byDevice.get(device.id) ?? [];
        const online = provider.isOnline(device.id);
        return {
          device,
          readings,
          online,
          lastSeen: provider.lastSeen(device.id),
          status: worstStatus(online, readings),
          locatable: resolution.resolved.has(device.id),
        };
      })
      .sort((a, b) => {
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        return byStatus !== 0 ? byStatus : a.device.label.localeCompare(b.device.label);
      });
  }, [deviceList, latest, resolution, provider]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.device.id === selectedDeviceId) ?? null,
    [rows, selectedDeviceId],
  );

  const visibleHistory =
    history && history.deviceId === selectedDeviceId && selectedRow?.online
      ? history.byMetric
      : EMPTY_HISTORY;

  // ─── Selection + camera ─────────────────────────────────────────────────────
  const select = useCallback(
    (deviceId: string) => {
      setRawSelectedId(deviceId);

      const target = resolution.resolved.get(deviceId);
      if (!target) return; // Not in a loaded model — the row says so; nothing to fly to.

      if (!components) return;
      const view = components.get(IotView);
      view.setWorld(world);
      void view.zoomTo(target);
    },
    [resolution, world, components],
  );

  const clearSelection = useCallback(() => setRawSelectedId(null), []);

  return {
    rows,
    selectedDeviceId,
    selectedRow,
    history: visibleHistory,
    resolved: resolution.resolved,
    isLoading,
    error,
    isEmpty: !isLoading && !error && deviceList.length === 0,
    select,
    clearSelection,
  };
}
