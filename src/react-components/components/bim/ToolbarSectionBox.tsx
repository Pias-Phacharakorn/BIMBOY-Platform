import { useState, useEffect, useRef } from "react";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { SectionBox, SectionBoxState } from "@/bim-components/SectionBox";

const AXES = [
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "z", label: "Z" },
] as const;

/**
 * Right-rail crop volume. Adopts ToolbarClip's shape — action list, divider, live pane — rather
 * than inventing a fourth menu layout.
 *
 * Unlike Measure/Clip/Coordinate this button does **not** drive `bimStore.activeTool`: a crop is
 * view state you keep on while selecting and measuring, and `activeTool` would cost the selection
 * outliner and the whole postproduction pass for as long as the box was live. So there is no
 * mutual exclusion with **Measure or Coordinate**, by design.
 *
 * It *is* mutually exclusive with Clip, but through `SectioningArbiter` rather than `activeTool` —
 * turning the box on switches the cut planes off and back on again afterwards. Nothing here has to
 * arrange that: the arbiter watches `SectionBox.onStateChanged`, which `toggle()` already fires.
 */
export function ToolbarSectionBox() {
  const { components, selectedElementIds } = useBimStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [state, setState] = useState<SectionBoxState>({
    active: false,
    min: null,
    max: null,
  });
  const [busy, setBusy] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mirror SectionBox — the engine owns the truth, this component only renders it.
  useEffect(() => {
    if (!components) return;
    const sectionBox = components.get(SectionBox);

    const syncState = () => setState(sectionBox.state);
    syncState();

    sectionBox.onStateChanged.add(syncState);
    return () => {
      sectionBox.onStateChanged.remove(syncState);
    };
  }, [components]);

  if (!components) return null;

  const handleToggle = () => {
    const sectionBox = components.get(SectionBox);
    sectionBox.toggle();
  };

  const handleFitToSelection = async () => {
    // The live selection, not bimStore.selectionMap — that clone is one event behind, so acting
    // on it would box the *previous* selection. Same split ToolbarFocus and ToolbarVisibility make.
    const selection = components.get(OBF.Highlighter).selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;

    setBusy(true);
    try {
      await components.get(SectionBox).fitToSelection(selection);
    } catch (err) {
      console.error("[ToolbarSectionBox] Fit to selection failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleResetToModel = () => {
    components.get(SectionBox).fitToModels();
  };

  const hasSelection = selectedElementIds.length > 0;
  const isActive = state.active;
  const buttonClass = `inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 ${
    isActive || isDropdownOpen ? "text-accent-2 bg-surface-alt border-border" : "text-white"
  }`;
  const rowClass =
    "w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold text-fg hover:bg-surface-alt hover:border-border disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-transparent";

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        className={buttonClass}
        title="Section Box"
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <Icon name="SECTIONBOX" size={20} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-full mr-2.5 top-0 z-50 rounded-xl bg-surface border border-border shadow-xl p-4 backdrop-blur-md animate-in fade-in slide-in-from-right-1 duration-150 flex flex-col gap-3.5 text-left w-60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg uppercase tracking-wider">Section Box</span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Toggle */}
            <button
              type="button"
              onClick={handleToggle}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-radius transition-all duration-120 border border-transparent cursor-pointer font-semibold ${
                isActive
                  ? "bg-accent-2/15 text-accent-2 border-accent-2"
                  : "text-fg hover:bg-surface-alt hover:border-border"
              }`}
            >
              <Icon name="SECTIONBOX" size={16} />
              <span className="flex-1">Section box</span>
              <span className="text-[11px] uppercase tracking-wider opacity-70">
                {isActive ? "On" : "Off"}
              </span>
            </button>

            {/*
              group sits on the wrapper div, not the button: a native <button disabled> does not
              reliably match :hover across engines, so the pill would hide on exactly the row that
              needs explaining. Same reason ToolbarVisibility does it this way.
            */}
            <div className="group relative">
              <button
                type="button"
                onClick={handleFitToSelection}
                disabled={!hasSelection || busy}
                className={rowClass}
              >
                <Icon name="ISOLATE" size={16} className={busy ? "animate-spin" : ""} />
                <span>Fit to selection</span>
              </button>
              {!hasSelection && (
                <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-radius border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-muted opacity-0 shadow-lg transition-opacity duration-120 group-hover:opacity-100">
                  Fit to selection — select items first
                </span>
              )}
            </div>

            {/* Reset */}
            <button type="button" onClick={handleResetToModel} className={rowClass}>
              <Icon name="REFRESH" size={16} />
              <span>Reset to model</span>
            </button>
          </div>

          <div className="h-[1px] bg-border/60 my-0.5" />

          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted uppercase tracking-wider px-1">
            <span>Extents</span>
          </div>

          {!state.min || !state.max ? (
            <div className="text-xs text-muted italic px-1">No model measured yet</div>
          ) : (
            <div className="flex flex-col gap-1">
              {AXES.map(({ key, label }) => {
                const min = state.min![key];
                const max = state.max![key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 px-2.5 py-1 text-xs text-fg"
                  >
                    <span className="font-bold text-muted w-3">{label}</span>
                    <span className="font-mono tabular-nums">
                      {min.toFixed(2)} → {max.toFixed(2)}
                    </span>
                    <span className="font-mono tabular-nums text-muted w-14 text-right">
                      {(max - min).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
