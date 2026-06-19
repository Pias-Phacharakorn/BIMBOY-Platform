import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Scissors, Trash2 } from "lucide-react";
import { deleteSelectedClipperPlane } from "./ThatOpenClipperBridge";

export function ClipperMenu() {
  const enabled = useDigitalTwinStore((s) => s.clipperEnabled);
  const toggle = useDigitalTwinStore((s) => s.toggleClipper);
  const count = useDigitalTwinStore((s) => s.clipperPlaneCount);

  const active = enabled || count > 0;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        title={enabled ? "Clipper on — double-click a face to place a plane" : "Clipper off"}
        className={`group relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
        }`}
      >
        <Scissors className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
            {count}
          </span>
        )}
        <span className="pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded bg-popover px-2 py-0.5 text-[10px] text-popover-foreground opacity-0 shadow group-hover:opacity-100">
          {enabled ? "Clipper: double-click face" : "Clipper"}
        </span>
      </button>
      {count > 0 && (
        <button
          onClick={() => deleteSelectedClipperPlane()}
          title="Delete selected (last created/moved) plane"
          className="group relative flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
          <span className="pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded bg-popover px-2 py-0.5 text-[10px] text-popover-foreground opacity-0 shadow group-hover:opacity-100">
            Delete selected plane
          </span>
        </button>
      )}
    </div>
  );
}
