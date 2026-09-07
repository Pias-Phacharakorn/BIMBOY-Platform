/**
 * The bind flow's state: what is selected in the viewport, whether it can become a device, and the
 * save itself.
 *
 * **Reads the selection the user already made.** `ViewportWrapper` publishes every pick to
 * `bimStore`; this hook reads it. It deliberately does *not* introduce an arm-then-pick mode —
 * Measure, Clip, Sectionbox and Isolate already compete for the pointer, enough that
 * `SectioningArbiter` exists to referee them and `ClipperPlacementManager` holds a lifetime-long
 * global Escape handler. A fifth claimant would have to negotiate with both.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { IotView } from "@/bim-components/IotView";
import { conflictOf } from "./iotDevicesService";
import { useCreateIotDevice } from "./useIotDeviceQueries";
import type { IotDevice, Metric } from "./iotTypes";

/** Why binding is unavailable, or `null` when it is available. */
export type BindBlocker =
  | "no-selection"
  | "multi-selection"
  | "no-guid"
  | "already-bound"
  | "reading";

export interface BindCandidate {
  modelId: string;
  localId: number;
  ifcGuid: string;
  category: string | null;
  /** Suggested label, from the element itself. Editable before saving. */
  suggestedLabel: string;
}

export interface UseIotBinding {
  blocker: BindBlocker | null;
  candidate: BindCandidate | null;
  /** The device this element already is, when `blocker === "already-bound"`. */
  existing: IotDevice | null;
  isSaving: boolean;
  /** Set when the save was refused by a uniqueness rule, so the panel can explain which. */
  saveError: string | null;
  save: (input: { label: string; metrics: Metric[]; deviceCode: string }) => Promise<boolean>;
}

/** Exactly one element selected → its `{modelId, localId}`; otherwise how many were selected. */
function soleSelection(
  selectionMap: Record<string, Set<number>>,
): { modelId: string; localId: number } | number {
  let found: { modelId: string; localId: number } | null = null;
  let count = 0;

  for (const [modelId, ids] of Object.entries(selectionMap)) {
    for (const localId of ids) {
      count++;
      if (count > 1) return count;
      found = { modelId, localId };
    }
  }
  return found ?? 0;
}

export function useIotBinding(
  isActive: boolean,
  projectId: string | undefined,
  userId: string | undefined,
  devices: readonly IotDevice[],
): UseIotBinding {
  const { components, selectionMap } = useBimStore();
  const createDevice = useCreateIotDevice(projectId);

  /**
   * The result of probing one specific selection, tagged with the selection it describes.
   *
   * ⚠️ Tagged deliberately. An earlier version kept `candidate`, `isReading` and `noGuid` as three
   * independent flags, and because the probe sets them inside an async body there was one render
   * where a new selection had arrived but none of the three had been updated yet — so "nothing is
   * blocking" and "there is no candidate" were true at the same time, and the panel dereferenced
   * null. Deriving everything from `probe.key === selectionKey` removes that window by
   * construction rather than by ordering.
   */
  const [probe, setProbe] = useState<{ key: string; candidate: BindCandidate | null } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const generationRef = useRef(0);
  useEffect(() => () => void generationRef.current++, []);

  const selection = useMemo(
    () => soleSelection(selectionMap as Record<string, Set<number>>),
    [selectionMap],
  );

  const selectionKey =
    typeof selection === "number" ? `count:${selection}` : `${selection.modelId}:${selection.localId}`;

  // Read the element's GlobalId and category whenever the single selection changes.
  useEffect(() => {
    if (!isActive || !components || typeof selection === "number") return;

    const generation = ++generationRef.current;
    const isStale = () => generationRef.current !== generation;

    void (async () => {
      setSaveError(null);
      const described = await components
        .get(IotView)
        .describeElement(selection.modelId, selection.localId);
      if (isStale()) return;

      // `described === null` means the element has no GlobalId — no anchor that survives a model
      // re-export — so the probe records a candidate-less result and the panel refuses.
      setProbe({
        key: selectionKey,
        candidate: described
          ? {
              modelId: selection.modelId,
              localId: selection.localId,
              ifcGuid: described.ifcGuid,
              category: described.category,
              // Prefilled so nobody names twenty sensors by hand. Still editable.
              suggestedLabel: described.category
                ? `${described.category} ${selection.localId}`
                : `Device ${selection.localId}`,
            }
          : null,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, components, selectionKey]);

  /** Only trust a probe that describes the selection currently on screen. */
  const settled = probe && probe.key === selectionKey ? probe : null;
  const candidate = settled?.candidate ?? null;

  const existing = useMemo(
    () => (candidate ? devices.find((d) => d.ifcGuid === candidate.ifcGuid) ?? null : null),
    [candidate, devices],
  );

  const blocker: BindBlocker | null = useMemo(() => {
    if (typeof selection === "number") return selection === 0 ? "no-selection" : "multi-selection";
    if (!settled) return "reading";
    if (!settled.candidate) return "no-guid";
    if (existing) return "already-bound";
    return null;
  }, [selection, settled, existing]);

  const save = useCallback(
    async ({ label, metrics, deviceCode }: { label: string; metrics: Metric[]; deviceCode: string }) => {
      if (!projectId || !candidate) return false;
      setSaveError(null);
      try {
        await createDevice.mutateAsync({
          projectId,
          ifcGuid: candidate.ifcGuid,
          modelId: candidate.modelId,
          deviceCode: deviceCode.trim() || null,
          label,
          elementCategory: candidate.category,
          metrics,
          createdBy: userId ?? null,
        });
        return true;
      } catch (err) {
        // Name which rule was broken. A raw constraint name helps nobody, and the two conflicts
        // have completely different fixes.
        const conflict = conflictOf(err);
        setSaveError(
          conflict === "device_code"
            ? "That device code is already used by another device in this project."
            : conflict === "element"
              ? "This element is already bound to a device."
              : "Could not save the device. Check your permissions and try again.",
        );
        return false;
      }
    },
    [projectId, candidate, userId, createDevice],
  );

  return {
    blocker,
    candidate,
    existing,
    isSaving: createDevice.isPending,
    saveError,
    save,
  };
}
