import { useEffect, useReducer, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import { DrawingEditorSetup } from "@/bim-components";
import { useBimStore } from "@/react-components/store/bimStore";

/**
 * Right-hand "List View Level" panel for the "Drawing Editor" tab. Owns the
 * DrawingEditorSetup engine's activate/deactivate lifecycle: activates on
 * mount, deactivates on unmount (switching tabs resets the drawing —
 * session-only, per CONTEXT.md). Levels are real building storeys
 * discovered from the loaded model(s) via OBC.Views.createFromIfcStoreys —
 * see CONTEXT.md's "real per-building-storey Levels" follow-up.
 */
export function DrawingEditorPanel() {
  const { components, world } = useBimStore();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const [selectingLevelId, setSelectingLevelId] = useState<string | null>(null);
  const modelVisibleRef = useRef<any>(null);

  const des = components ? components.get(DrawingEditorSetup) : null;

  useEffect(() => {
    if (!components || !world || !des) return;
    void des.activate(world);
    des.onChanged.add(forceRender);
    return () => {
      des.onChanged.remove(forceRender);
      des.deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, world]);

  useEffect(() => {
    const checkboxEl = modelVisibleRef.current;
    if (!checkboxEl) return;
    const handleChange = (e: any) => {
      if (!components) return;
      const fragments = components.get(OBC.FragmentsManager);
      for (const [, model] of fragments.list) {
        model.object.visible = e.target.checked;
      }
    };
    checkboxEl.addEventListener("change", handleChange);
    return () => checkboxEl.removeEventListener("change", handleChange);
  }, [components]);

  if (!components || !world || !des) {
    return <div className="p-3 text-xs text-muted">Load a model to use the Drawing Editor.</div>;
  }

  const handleSelectLevel = async (levelId: string) => {
    if (selectingLevelId) return;
    setSelectingLevelId(levelId);
    try {
      const fragments = components.get(OBC.FragmentsManager);
      await des.selectLevel(levelId, fragments);
    } finally {
      setSelectingLevelId(null);
    }
  };

  const layers = des.drawing ? [...des.drawing.layers].filter(([name]) => name !== "0") : [];
  const isDiscovering = !!des.editor && des.levels.length === 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        {!des.editor && <p className="text-xs text-muted">Initializing drawing…</p>}

        {layers.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Layers</span>
            {layers.map(([name, layer]: [string, any]) => (
              <bim-checkbox
                key={name}
                label={name}
                checked={layer.visible}
                onChange={(e: any) => des.setLayerVisible(name, e.target.checked)}
              />
            ))}
          </div>
        )}

        <bim-checkbox ref={modelVisibleRef} label="Show model" checked />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isDiscovering && <p className="p-1 text-xs text-muted">Reading levels from the model…</p>}
        {des.editor && des.levels.length === 0 && !isDiscovering && (
          <p className="p-1 text-xs text-muted">No building storeys found in the loaded model(s).</p>
        )}

        <div className="flex flex-col gap-1">
          {des.levels.map((level) => {
            const cachedProjected = level.id === des.activeLevelId && des.isProjected;
            const isActive = level.id === des.activeLevelId;
            const isSelecting = selectingLevelId === level.id;
            return (
              <button
                key={level.id}
                type="button"
                disabled={!!selectingLevelId}
                onClick={() => handleSelectLevel(level.id)}
                title={isActive ? "Currently shown in the Sheet View" : "Click to show this level in the Sheet View"}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-all disabled:opacity-50 ${
                  isActive ? "bg-surface-alt text-fg" : "text-muted hover:bg-surface-alt hover:text-fg"
                }`}
              >
                <span>{isSelecting ? "Projecting…" : level.name}</span>
                {cachedProjected && <div className="h-2 w-2 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
