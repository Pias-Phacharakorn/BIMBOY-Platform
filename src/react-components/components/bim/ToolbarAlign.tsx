import { useState, useRef, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { cn } from "@/lib/utils";

export function ToolbarAlign() {
  const {
    alignAngle,
    aligningDirection,
    setAligningDirection,
    resetAlignment,
    world,
  } = useBimStore();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!world) return null;

  const handleSelectDirection = (direction: "front" | "back" | "left" | "right") => {
    setAligningDirection(direction);
    setIsOpen(false);
  };

  const handleReset = () => {
    resetAlignment();
    setIsOpen(false);

    // Trigger ViewCube update dynamically
    const camera = world.camera as any;
    if (camera?.controls) {
      camera.controls.dispatchEvent({ type: "update" });
    }
  };

  const handleCancel = () => {
    setAligningDirection(null);
  };

  const buttonClass = cn(
    "relative inline-flex items-center justify-center gap-2 min-h-8 p-1 border rounded-radius bg-transparent cursor-pointer text-xs font-semibold transition-all duration-120 text-white",
    aligningDirection
      ? "border-accent bg-accent/10 text-accent animate-pulse"
      : isOpen
      ? "border-border bg-surface-alt text-fg"
      : "border-transparent hover:border-border hover:bg-surface-alt hover:text-fg"
  );

  const menuItemClass =
    "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-fg hover:bg-surface-raised hover:text-accent transition-colors duration-100 cursor-pointer select-none text-left";

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      {aligningDirection ? (
        <div className="flex items-center gap-1.5 bg-accent/8 border border-accent/20 rounded-radius pl-2 pr-1 py-0.5 animate-in fade-in zoom-in-95 duration-150">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
            Align {aligningDirection}
          </span>
          <button
            onClick={handleCancel}
            className="p-0.5 rounded hover:bg-accent/15 text-accent cursor-pointer transition-colors"
            title="Cancel Alignment"
            type="button"
          >
            <Icon name="CLOSE" size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={buttonClass}
          title="Align ViewCube to Face"
          type="button"
        >
          <Icon name="ALIGN" size={20} />
          {alignAngle !== 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border border-surface" />
          )}
        </button>
      )}

      {isOpen && !aligningDirection && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 rounded-lg bg-surface border border-border shadow-xl z-50 overflow-hidden py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-muted uppercase tracking-wider select-none border-b border-border/40">
            Set Face Direction
          </div>
          <button
            onClick={() => handleSelectDirection("front")}
            className={menuItemClass}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span>Set Front</span>
          </button>
          <button
            onClick={() => handleSelectDirection("back")}
            className={menuItemClass}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Set Back</span>
          </button>
          <button
            onClick={() => handleSelectDirection("left")}
            className={menuItemClass}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>Set Left</span>
          </button>
          <button
            onClick={() => handleSelectDirection("right")}
            className={menuItemClass}
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>Set Right</span>
          </button>

          {alignAngle !== 0 && (
            <>
              <div className="mx-2 my-1 border-t border-border/40" />
              <button
                onClick={handleReset}
                className={cn(menuItemClass, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                type="button"
              >
                <Icon name="CLEAR" size={14} className="shrink-0" />
                <span>Reset Alignment</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
