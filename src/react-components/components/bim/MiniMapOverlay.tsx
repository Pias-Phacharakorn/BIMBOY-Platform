import { useEffect, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";
import { MiniMap } from "@/bim-components/MiniMap";

export function MiniMapOverlay() {
  const { components } = useBimStore();
  const { showMinimap, setShowMinimap } = useUIStore();
  const mountRef = useRef<HTMLDivElement>(null);

  // Mount the MiniMap uiContainer into the React ref div
  useEffect(() => {
    if (!components || !mountRef.current) return;

    let minimap: MiniMap | null = null;
    try {
      minimap = components.get(MiniMap);
    } catch {
      return;
    }
    if (!minimap) return;

    const container = mountRef.current;
    container.innerHTML = "";
    container.appendChild(minimap.uiContainer);

    return () => {
      // Detach without disposing — MiniMap lifecycle is owned by setupComponents
      if (container.contains(minimap!.uiContainer)) {
        container.removeChild(minimap!.uiContainer);
      }
    };
  }, [components]);

  if (!components) return null;

  const handleZoomIn = () => {
    try {
      components.get(MiniMap)?.zoomIn();
    } catch {}
  };

  const handleZoomOut = () => {
    try {
      components.get(MiniMap)?.zoomOut();
    } catch {}
  };

  const handleRotate = () => {
    try {
      components.get(MiniMap)?.rotate();
    } catch {}
  };

  return (
    <div
      className={`absolute top-3 left-3 z-20 flex flex-col rounded-xl overflow-hidden border border-white/10 shadow-2xl ${!showMinimap ? "hidden" : ""}`}
      style={{ width: 300, height: 240 }}
      aria-label="Mini map overlay"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-black/60 backdrop-blur-md border-b border-white/10 shrink-0">
        <span className="text-[10px] font-semibold text-white/60 uppercase tracking-widest select-none">
          Mini Map
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleZoomOut}
            title="Zoom out"
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
          >
            −
          </button>
          <button
            onClick={handleZoomIn}
            title="Zoom in"
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
          >
            +
          </button>
          <button
            onClick={handleRotate}
            title="Rotate map 90°"
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs"
          >
            ↻
          </button>
          <button
            onClick={() => setShowMinimap(false)}
            title="Hide mini map"
            type="button"
            className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Canvas mount point */}
      <div
        ref={mountRef}
        className="flex-1 min-h-0 bg-[#1e1e1e]"
        style={{ position: "relative" }}
      />
    </div>
  );
}
