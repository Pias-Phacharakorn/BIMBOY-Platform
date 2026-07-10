import type { ClashItem } from "@/types";

/**
 * Sequential display ID matching the #ID column in ClashTable/ClashList:
 * `clashItems` is fetched newest-first, but the most recent clash gets the
 * highest number (like an ever-incrementing ticket counter), so the number
 * is derived from array length minus position, not raw position.
 */
export function getClashSeqId(clashItems: Pick<ClashItem, "id">[], index: number): number {
  return clashItems.length - index;
}

export const statusLabelMap: Record<ClashItem["status"], string> = {
  new: "NEW",
  unresolved: "UNRESOLVED",
  resolved: "RESOLVED",
  approved_as_note: "APPROVED",
};

export const statusToneClassMap: Record<ClashItem["status"], string> = {
  new: "border-[oklch(63%_0.18_28_/_42%)] bg-[oklch(63%_0.18_28_/_13%)] text-status-danger",
  unresolved: "border-[oklch(70%_0.17_55_/_42%)] bg-[oklch(70%_0.17_55_/_13%)] text-[oklch(70%_0.17_55)]",
  resolved: "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn",
  approved_as_note: "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok",
};

/** Same per-status color as statusToneClassMap, as a solid bg- class for indicators (e.g. ClashList's status bar) that don't use the full pill styling. */
export const statusAccentClassMap: Record<ClashItem["status"], string> = {
  new: "bg-status-danger",
  unresolved: "bg-[oklch(70%_0.17_55)]",
  resolved: "bg-status-warn",
  approved_as_note: "bg-status-ok",
};

export const typeLabelMap: Record<ClashItem["type"], string> = {
  major: "MAJOR",
  minor: "MINOR",
  regulation: "REGULATION",
};

export const typeDotClassMap: Record<ClashItem["type"], string> = {
  major: "bg-status-danger ring-status-danger/20",
  minor: "bg-status-warn ring-status-warn/20",
  regulation: "bg-muted ring-muted/20",
};

/** Same per-type color as typeDotClassMap, without the ring — for indicators (e.g. the Type dropdown's option bars) that don't want the dot's ring styling. */
export const typeAccentClassMap: Record<ClashItem["type"], string> = {
  major: "bg-status-danger",
  minor: "bg-status-warn",
  regulation: "bg-muted",
};

/** Shared size/ring classes for the type-dot indicator, so every usage renders identically. */
export const TYPE_DOT_BASE_CLASS = "inline-block w-2 h-2 rounded-full ring-[3px] shrink-0";
