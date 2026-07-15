import { useEffect, useRef } from "react";
import * as OBF from "@thatopen/components-front";
import { useBimStore } from "@/react-components/store/bimStore";
import { ToolbarMeasure } from "./ToolbarMeasure";
import { ToolbarClip } from "./ToolbarClip";
import { ToolbarCoordinate } from "./ToolbarCoordinate";

export function ViewportRightToolbar() {
  const { components, world, activeTool } = useBimStore();

  // Snapshot of the viewport effects we suppress while a tool is active, so we
  // can restore them exactly (not force defaults) when returning to select/idle.
  const fxBaselineRef = useRef<{
    hoverer: boolean;
    outliner: boolean;
    postproduction: boolean;
  } | null>(null);

  // While any viewport tool is active, CursorSurface is the on-model guide, so
  // the element hover-highlight and the selection outliner/postproduction pass
  // are redundant — and they cost a raycast + a fullscreen post pass every
  // frame. Suppress them for any tool other than plain select, then restore the
  // user's prior state on return.
  useEffect(() => {
    if (!components) return;
    const hoverer = components.get(OBF.Hoverer);
    const outliner = components.get(OBF.Outliner);
    const postproduction = world?.renderer
      ? (world.renderer as any).postproduction
      : null;
    const toolActive = !!activeTool && activeTool !== "select";

    if (toolActive) {
      if (fxBaselineRef.current === null) {
        fxBaselineRef.current = {
          hoverer: hoverer.enabled,
          outliner: outliner.enabled,
          postproduction: postproduction ? postproduction.enabled : false,
        };
      }
      hoverer.enabled = false;
      outliner.enabled = false;
      if (postproduction) postproduction.enabled = false;
    } else if (fxBaselineRef.current !== null) {
      hoverer.enabled = fxBaselineRef.current.hoverer;
      outliner.enabled = fxBaselineRef.current.outliner;
      if (postproduction) postproduction.enabled = fxBaselineRef.current.postproduction;
      fxBaselineRef.current = null;
    }
  }, [components, world, activeTool]);

  // Restore the suppressed effects if we unmount while a tool is still active.
  useEffect(() => {
    return () => {
      if (!components || fxBaselineRef.current === null) return;
      const hoverer = components.get(OBF.Hoverer);
      const outliner = components.get(OBF.Outliner);
      const postproduction = world?.renderer
        ? (world.renderer as any).postproduction
        : null;
      hoverer.enabled = fxBaselineRef.current.hoverer;
      outliner.enabled = fxBaselineRef.current.outliner;
      if (postproduction) postproduction.enabled = fxBaselineRef.current.postproduction;
      fxBaselineRef.current = null;
    };
  }, [components, world]);

  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 p-1 border border-border bg-surface/94 rounded-[14px] backdrop-blur-md">
        <ToolbarMeasure />
        <ToolbarClip />
        <ToolbarCoordinate />
      </div>
    </div>
  );
}
