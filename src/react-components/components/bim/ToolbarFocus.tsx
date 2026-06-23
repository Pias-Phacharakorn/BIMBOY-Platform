import { useState } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

export function ToolbarFocus() {
  const { components, world } = useBimStore();
  const [loading, setLoading] = useState(false);

  if (!components || !world) return null;

  const handleFocus = async () => {
    if (!(world.camera instanceof OBC.SimpleCamera)) return;
    const highlighter = components.get(OBF.Highlighter);
    const selection = highlighter.selection.select;
    
    setLoading(true);
    try {
      await world.camera.fitToItems(
        OBC.ModelIdMapUtils.isEmpty(selection) ? undefined : selection
      );
    } catch (err) {
      console.error("[ToolbarFocus] Fit to items failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const buttonClass =
    "inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 text-white disabled:opacity-50";

  return (
    <button
      className={buttonClass}
      title="Focus"
      type="button"
      onClick={handleFocus}
      disabled={loading}
    >
      <Icon name="FOCUS" size={20} className={loading ? "animate-spin" : ""} />
    </button>
  );
}
