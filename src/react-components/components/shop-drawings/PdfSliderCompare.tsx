import { useCallback, useRef, useState } from "react";

interface PdfSliderCompareProps {
  imageA: string; // Newer revision
  imageB: string; // Older revision
  zoomLevel: number;
  height?: string;
}

export function PdfSliderCompare({ imageA, imageB, zoomLevel, height }: PdfSliderCompareProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const sliding = useRef(false);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const updateSlider = useCallback((clientX: number) => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const rect = container.getBoundingClientRect();
    const xInContent = clientX - rect.left + container.scrollLeft;
    const pct = Math.max(0, Math.min(100, (xInContent / inner.offsetWidth) * 100));
    setSliderPos(pct);
  }, []);

  // Pressing on the handle (with a generous invisible hit-zone) drags the slider.
  const handleSlidePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      sliding.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateSlider(e.clientX);
    },
    [updateSlider]
  );

  const handleSlidePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (sliding.current) updateSlider(e.clientX);
    },
    [updateSlider]
  );

  const handleSlidePointerUp = useCallback((e: React.PointerEvent) => {
    sliding.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // Pressing anywhere else in the container pans (scrolls) the view.
  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
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

  const handlePanPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panning.current) return;
    const container = containerRef.current;
    if (!container) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    container.scrollLeft = panStart.current.scrollLeft - dx;
    container.scrollTop = panStart.current.scrollTop - dy;
  }, []);

  const handlePanPointerUp = useCallback((e: React.PointerEvent) => {
    panning.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto border border-border rounded-radius bg-surface-alt select-none cursor-grab active:cursor-grabbing"
      style={{ height: height || "60vh" }}
      onPointerDown={handlePanPointerDown}
      onPointerMove={handlePanPointerMove}
      onPointerUp={handlePanPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pointer-events-none sticky top-0 left-0 z-20 flex justify-between p-2">
        <span className="bg-surface/80 backdrop-blur-sm text-[10px] px-2 py-1 rounded-radius font-semibold text-fg">Newer</span>
        <span className="bg-surface/80 backdrop-blur-sm text-[10px] px-2 py-1 rounded-radius font-semibold text-fg">Older</span>
      </div>

      <div ref={innerRef} className="relative" style={{ width: `${zoomLevel * 100}%` }}>
        <img src={imageB} alt="Older revision" className="w-full block" draggable={false} />

        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
          <img src={imageA} alt="Newer revision" className="w-full block" draggable={false} />
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          {/* Larger invisible hit-zone around the visible handle so it's not fiddly to grab */}
          <div
            className="sticky top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center pointer-events-auto"
            style={{ cursor: "col-resize" }}
            onPointerDown={handleSlidePointerDown}
            onPointerMove={handleSlidePointerMove}
            onPointerUp={handleSlidePointerUp}
          >
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-md">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M5 3L2 8L5 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 3L14 8L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
