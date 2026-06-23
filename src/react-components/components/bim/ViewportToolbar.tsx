import { useBimStore } from "@/react-components/store/bimStore";
import { ToolbarLoadModel } from "./ToolbarLoadModel";
import { ToolbarFocus } from "./ToolbarFocus";
import { ToolbarShowAll } from "./ToolbarShowAll";
import { ToolbarGhost } from "./ToolbarGhost";
import { ToolbarSettings } from "./ToolbarSettings";

export function ViewportToolbar() {
  const { components } = useBimStore();

  if (!components) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1 border border-border bg-surface/94 rounded-[14px] backdrop-blur-md">
      <ToolbarLoadModel />
      <div className="w-[1px] h-4 bg-border" />
      <ToolbarFocus />
      <ToolbarShowAll />
      <ToolbarGhost />
      <div className="w-[1px] h-4 bg-border" />
      <ToolbarSettings />
    </div>
  );
}
