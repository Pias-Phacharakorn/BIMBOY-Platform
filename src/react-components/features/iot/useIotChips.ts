/**
 * Keeps the viewport's floating reading chips in step with the device list.
 *
 * This hook is the *mirror*: it derives what each chip should say from the same rows the panel
 * renders, and hands that to `IotView`, which owns the scene objects. The engine layer computes no
 * status and knows no thresholds — deriving them twice is how a chip and its row end up disagreeing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import { IotView, type IotChipRequest, type ResolvedDevice } from "@/bim-components/IotView";
import { appIcons } from "@/globals";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";
import { METRICS, formatValue, headlineReading } from "./iotThresholds";
import { TICK_MS } from "./mockIotProvider";
import type { DeviceStatus } from "./iotTypes";
import type { IotDeviceRow } from "./useIotDevices";

/** Alarms first, so the display cap never drops the one device worth looking at. */
const CHIP_PRIORITY: Record<DeviceStatus, number> = {
  alarm: 0,
  warn: 1,
  ok: 2,
  offline: 3,
};

/** The second reading, shown only on the selected chip. */
function secondary(row: IotDeviceRow) {
  const primary = headlineReading(row.readings);
  const other = row.readings.find((r) => r !== primary);
  if (!other) return undefined;
  return `${formatValue(other.metric, other.value)} ${METRICS[other.metric].unit}`;
}

export function useIotChips(
  isActive: boolean,
  rows: IotDeviceRow[],
  resolved: ReadonlyMap<string, ResolvedDevice>,
  selectedDeviceId: string | null,
  onChipClicked: (deviceId: string) => void,
) {
  const { components, world, activeTool } = useBimStore();
  const chipsVisible = useUIStore((state) => state.iotChipsVisible);

  /** Device ids currently on visible geometry. Polled — there is no visibility event to listen to. */
  const [visibleDevices, setVisibleDevices] = useState<ReadonlySet<string> | null>(null);
  const visibilityEpoch = useUIStore((state) => state.visibilityEpoch);

  const iotView = useMemo(() => (components ? components.get(IotView) : null), [components]);

  // The click handler changes identity every render; a ref keeps the engine subscription stable so
  // the component is not re-subscribed on each keystroke elsewhere in the tab. Written in an effect
  // rather than during render — reading or writing a ref while rendering is not allowed.
  const clickRef = useRef(onChipClicked);
  useEffect(() => {
    clickRef.current = onChipClicked;
  }, [onChipClicked]);

  // ── Lifecycle: mount activates, unmount disposes ────────────────────────────
  // Chips cannot be occluded, so a hidden-but-mounted layer would float over every other tab —
  // the exact bug `ModelsView` warns about for the Room tab's chips.
  useEffect(() => {
    if (!iotView || !isActive) return;
    iotView.setWorld(world);
    iotView.activate();
    return () => iotView.deactivate();
  }, [iotView, isActive, world]);

  useEffect(() => {
    if (!iotView) return;
    const handler = (deviceId: string) => clickRef.current(deviceId);
    iotView.onChipClicked.add(handler);
    return () => iotView.onChipClicked.remove(handler);
  }, [iotView]);

  // ── The layer switch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!iotView) return;
    iotView.setLayerVisible(chipsVisible);
  }, [iotView, chipsVisible]);

  // ── Chips stop taking clicks while a viewport tool is placing something ─────
  useEffect(() => {
    if (!iotView) return;
    iotView.setInteractive(activeTool === null);
  }, [iotView, activeTool]);

  // ── Visibility: polled, because nothing emits an event for it ───────────────
  /**
   * `OBC.Hider` exposes no events and the fragments layer raises none either, so a chip can only
   * learn its element was hidden by asking. Two triggers: the store's visibility epoch (immediate,
   * for the toolbar's Show All / Isolate / Hide) and the regular tick (eventual, for everything
   * else — `SmartViews` hides geometry without touching the toolbar).
   */
  useEffect(() => {
    if (!iotView || !isActive || resolved.size === 0) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const visible = await iotView.filterVisible(resolved);
        if (!cancelled) setVisibleDevices(visible);
      } catch (err) {
        console.warn("[iot] failed to read chip visibility", err);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [iotView, isActive, resolved, visibilityEpoch]);

  // Cached element centres belong to a model list that may no longer hold.
  useEffect(() => {
    if (!iotView || !components || !isActive) return;
    const fragments = components.get(OBC.FragmentsManager);
    const onChanged = () => iotView.invalidateCentres();
    fragments.list.onItemSet.add(onChanged);
    fragments.list.onItemDeleted.add(onChanged);
    return () => {
      fragments.list.onItemSet.remove(onChanged);
      fragments.list.onItemDeleted.remove(onChanged);
    };
  }, [iotView, components, isActive]);

  // ── What each chip says ─────────────────────────────────────────────────────
  const requests = useMemo<IotChipRequest[]>(() => {
    const entries: IotChipRequest[] = [];

    for (const row of rows) {
      const target = resolved.get(row.device.id);
      if (!target) continue; // Not in a loaded model — nothing to anchor to.
      // `null` means visibility has not been read yet; showing chips is the better first frame.
      if (visibleDevices && !visibleDevices.has(row.device.id)) continue;

      const reading = headlineReading(row.readings);
      const selected = row.device.id === selectedDeviceId;
      const metric = reading?.metric ?? row.device.metrics[0] ?? "temperature";

      entries.push({
        deviceId: row.device.id,
        target,
        icon: appIcons[METRICS[metric].icon],
        value: row.online && reading ? formatValue(reading.metric, reading.value) : "",
        unit: reading ? METRICS[reading.metric].unit : "",
        tone: row.status,
        selected,
        secondary: selected ? secondary(row) : undefined,
      });
    }

    // The selected device always keeps a slot; the rest queue behind it worst-first.
    return entries.sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return CHIP_PRIORITY[a.tone] - CHIP_PRIORITY[b.tone];
    });
  }, [rows, resolved, selectedDeviceId, visibleDevices]);

  // `chipsVisible` is a dependency so switching the layer back on restores the chips immediately.
  // Without it the flag flips but nothing re-adds them, and they only reappear on the next
  // telemetry tick — several seconds of a switch that looks like it did nothing.
  useEffect(() => {
    if (!iotView || !isActive) return;
    void iotView.syncChips(requests);
  }, [iotView, isActive, requests, chipsVisible]);
}
