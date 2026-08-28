import { useEffect, useRef } from "react";
import * as OBF from "@thatopen/components-front";
import { useBimStore } from "@/react-components/store/bimStore";
import { ToolbarMeasure } from "./ToolbarMeasure";
import { ToolbarClip } from "./ToolbarClip";
import { ToolbarSectionBox } from "./ToolbarSectionBox";
import { ToolbarCoordinate } from "./ToolbarCoordinate";

export function ViewportRightToolbar() {
  const { components, activeTool } = useBimStore();

  // Snapshot of the viewport effects we suppress while a tool is active, so we
  // can restore them exactly (not force defaults) when returning to select/idle.
  const fxBaselineRef = useRef<{
    hoverer: boolean;
    outliner: boolean;
  } | null>(null);

  // While any viewport tool is active, CursorSurface is the on-model guide, so the element
  // hover-highlight and the selection outliner are redundant — and the hover costs a raycast
  // every frame. Suppress them for any tool other than plain select, then restore the user's
  // prior state on return.
  //
  // ⚠️ **Postproduction is deliberately not in this list.** It used to be, on the same
  // "redundant while a tool owns the cursor" reasoning — but that argument does not transfer.
  // Hover and outline are *selection affordances*; postproduction is *how the model looks*.
  // Suppressing it flipped the whole viewport flat the instant you pressed Add plane, and for
  // sectioning that is backwards: element edges are exactly what tells you which face you are
  // about to cut.
  //
  // It also bought nothing. `activeTool` only holds a non-select value for the moment a tool is
  // armed — `ClipperCursor` returns to "select" as soon as a placement resolves — so the sole
  // visible effect was a flat-render flash on every plane placed. The per-frame pass it saved was
  // already being paid in select mode, which is where the viewport spends nearly all its time.
  useEffect(() => {
    if (!components) return;
    const hoverer = components.get(OBF.Hoverer);
    const outliner = components.get(OBF.Outliner);
    const toolActive = !!activeTool && activeTool !== "select";

    if (toolActive) {
      if (fxBaselineRef.current === null) {
        fxBaselineRef.current = {
          hoverer: hoverer.enabled,
          outliner: outliner.enabled,
        };
      }
      hoverer.enabled = false;
      outliner.enabled = false;
    } else if (fxBaselineRef.current !== null) {
      hoverer.enabled = fxBaselineRef.current.hoverer;
      outliner.enabled = fxBaselineRef.current.outliner;
      fxBaselineRef.current = null;
    }
  }, [components, activeTool]);

  // Restore the suppressed effects if we unmount while a tool is still active.
  useEffect(() => {
    return () => {
      if (!components || fxBaselineRef.current === null) return;
      const hoverer = components.get(OBF.Hoverer);
      const outliner = components.get(OBF.Outliner);
      hoverer.enabled = fxBaselineRef.current.hoverer;
      outliner.enabled = fxBaselineRef.current.outliner;
      fxBaselineRef.current = null;
    };
  }, [components]);

  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 p-1 border border-border bg-surface/94 rounded-[14px] backdrop-blur-md">
        <ToolbarMeasure />
        <ToolbarClip />
        {/* Next to Clip because both are sectioning — but note it drives no activeTool, so it
            is exempt from the FX suppression above and coexists with the other three. */}
        <ToolbarSectionBox />
        <ToolbarCoordinate />
      </div>
    </div>
  );
}
