import { useCallback, useRef } from "react";

interface PdfOverlayCompareProps {
  image: string; // diff overlay rendered to a data URL
  zoomLevel: number;
  height?: string;
}

// Pan/zoom viewer for the overlay-diff image. Pure UI — mirrors the pan
// behaviour of PdfSliderCompare (press anywhere to drag-scroll) but shows a
// single composited image rather than two clipped layers.
export function PdfOverlayCompare({ image, zoomLevel, height }: PdfOverlayCompareProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    panning.current = true;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    container.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!panning.current) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
    container.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    panning.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto flex flex-col border border-border rounded-radius bg-surface-alt select-none cursor-grab active:cursor-grabbing"
      style={{ height: height || "60vh" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="shrink-0 m-auto" style={{ width: `${zoomLevel * 100}%` }}>
        <img src={image} alt="Revision differences" className="w-full block" draggable={false} />
      </div>
    </div>
  );
}
