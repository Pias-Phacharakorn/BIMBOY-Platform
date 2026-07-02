import { ToolbarMeasure } from "./ToolbarMeasure";
import { ToolbarClip } from "./ToolbarClip";
import { ToolbarCoordinate } from "./ToolbarCoordinate";

export function ViewportRightToolbar() {
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
