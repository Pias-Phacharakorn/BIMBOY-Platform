/**
 * The 4D tab's controller. Called once in `ModelsView` and passed to both the Gantt panel and the
 * timeline — they are siblings with the viewport between them, same reason as `useIotTab`.
 *
 * This hook is the *mirror*: the month, Play and "show unscheduled" live in
 * `constructionSequenceStore`; the `ConstructionSequence` component owns what the scene shows and
 * is told about every change here. It decides nothing about states — `ConstructionSchedule` does.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as OBC from "@thatopen/components";
import { ConstructionSequence } from "@/bim-components/ConstructionSequence";
import type { ConstructionSchedule, ScheduleTask } from "@/classes/ConstructionSchedule";
import { useBimStore } from "@/react-components/store/bimStore";
import { useConstructionSequenceStore } from "@/react-components/store/constructionSequenceStore";
import { useUIStore } from "@/react-components/store/uiStore";
import { parseScheduleFile } from "./parseScheduleFile";
import { useConstructionSchedule, useUploadConstructionSchedule } from "./useConstructionScheduleQueries";

/** Play speed — one Schedule month per second of wall time (settled in the grilling). */
const MONTHS_PER_SECOND = 1;

export function useConstructionSequence(
  isActive: boolean,
  projectId: string | undefined,
  userId: string | null,
  canManage: boolean,
) {
  const { components } = useBimStore();
  const query = useConstructionSchedule(projectId, isActive);
  const upload = useUploadConstructionSchedule(projectId, userId);
  const schedule: ConstructionSchedule | null = query.data?.schedule ?? null;

  const month = useConstructionSequenceStore((state) => state.month);
  const setMonth = useConstructionSequenceStore((state) => state.setMonth);
  const isPlaying = useConstructionSequenceStore((state) => state.isPlaying);
  const setPlaying = useConstructionSequenceStore((state) => state.setPlaying);
  const showUnscheduled = useConstructionSequenceStore((state) => state.showUnscheduled);
  const setShowUnscheduled = useConstructionSequenceStore((state) => state.setShowUnscheduled);
  const visibilityEpoch = useUIStore((state) => state.visibilityEpoch);
  const [unresolved, setUnresolved] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const sequence = useMemo(
    () => (components ? components.get(ConstructionSequence) : null),
    [components],
  );

  // ── Ownership: the tab owns visibility while it has a Schedule to show ──────
  const owns = isActive && !!schedule;

  useEffect(() => {
    if (!sequence || !owns) return;
    useUIStore.getState().setVisibilityLocked(true);
    sequence.activate();
    return () => {
      useUIStore.getState().setVisibilityLocked(false);
      useConstructionSequenceStore.getState().setPlaying(false);
      // Bumped after the restore so standing rules (IfcSpace) re-hide on top of Show All.
      void sequence.deactivate().then((restored) => {
        if (restored) useUIStore.getState().bumpVisibilityEpoch();
      });
    };
  }, [sequence, owns]);

  // Opening the tab, or a new Schedule (first load or Replace), starts at the last month, paused,
  // with Unscheduled elements hidden — the store is app-wide and would otherwise carry the last
  // project's choices over.
  useEffect(() => {
    if (!sequence) return;
    sequence.setSchedule(schedule);
    if (schedule && isActive) {
      setPlaying(false);
      setShowUnscheduled(false);
      setMonth(schedule.months);
    }
  }, [sequence, schedule, isActive, setMonth, setPlaying, setShowUnscheduled]);

  useEffect(() => {
    if (sequence && month !== null) sequence.setMonth(month);
  }, [sequence, month]);

  useEffect(() => {
    sequence?.setShowUnscheduled(showUnscheduled);
  }, [sequence, showUnscheduled]);

  // Show All on this tab means "the current month", not "everything".
  useEffect(() => {
    if (owns) sequence?.refresh();
  }, [sequence, owns, visibilityEpoch]);

  // A model that loads while the tab is open joins at the current month.
  useEffect(() => {
    if (!sequence || !components || !owns) return;
    const fragments = components.get(OBC.FragmentsManager);
    const onChanged = () => sequence.refresh();
    fragments.list.onItemSet.add(onChanged);
    fragments.list.onItemDeleted.add(onChanged);
    return () => {
      fragments.list.onItemSet.remove(onChanged);
      fragments.list.onItemDeleted.remove(onChanged);
    };
  }, [sequence, components, owns]);

  useEffect(() => {
    if (!sequence) return;
    // Event-only: the count starts at 0 and the component fires on every change after that.
    const handler = (count: number) => setUnresolved(count);
    sequence.onUnresolvedChanged.add(handler);
    return () => sequence.onUnresolvedChanged.remove(handler);
  }, [sequence]);

  // ── Play ────────────────────────────────────────────────────────────────────
  // Advances by wall time, so a slow frame never slows the sequence; the component turns most of
  // these frames into nothing because they stay inside one interval.
  useEffect(() => {
    if (!isPlaying || !schedule) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      const { month: current } = useConstructionSequenceStore.getState();
      const next = Math.min(schedule.months, (current ?? 0) + elapsed * MONTHS_PER_SECOND);
      setMonth(next);
      if (next >= schedule.months) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, schedule, setMonth, setPlaying]);

  const togglePlay = useCallback(() => {
    if (!schedule) return;
    const state = useConstructionSequenceStore.getState();
    if (state.isPlaying) {
      setPlaying(false);
      return;
    }
    // Play at the end replays from the start.
    if ((state.month ?? schedule.months) >= schedule.months) setMonth(0);
    setPlaying(true);
  }, [schedule, setMonth, setPlaying]);

  const scrubTo = useCallback(
    (value: number) => {
      setPlaying(false);
      setMonth(value);
    },
    [setMonth, setPlaying],
  );

  /** Clicking a Task jumps to its start and pauses. The camera stays where it is. */
  const jumpToTask = useCallback(
    (task: ScheduleTask) => {
      setPlaying(false);
      setMonth(task.start_month);
    },
    [setMonth, setPlaying],
  );

  // ── Upload ──────────────────────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      setUploadErrors([]);
      const parsed = await parseScheduleFile(file);
      if (!parsed.ok) {
        setUploadErrors(parsed.errors);
        return;
      }
      try {
        await upload.mutateAsync(parsed.schedule);
      } catch (err) {
        setUploadErrors([`Upload failed: ${(err as { message?: string })?.message ?? String(err)}`]);
      }
    },
    [upload],
  );

  return {
    schedule,
    isLoading: query.isLoading,
    loadError: query.error,
    canManage,
    month,
    isPlaying,
    showUnscheduled,
    setShowUnscheduled,
    unresolved,
    togglePlay,
    scrubTo,
    jumpToTask,
    uploadFile,
    isUploading: upload.isPending,
    uploadErrors,
  };
}

export type ConstructionSequenceTab = ReturnType<typeof useConstructionSequence>;
