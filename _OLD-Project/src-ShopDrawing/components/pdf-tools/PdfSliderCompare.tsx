import { useState, useRef, useCallback } from "react";

interface PdfSliderCompareProps {
  imageA: string; // Newer version
  imageB: string; // Older version
  zoomLevel: number;
  height?: string;
}

const PdfSliderCompare = ({ imageA, imageB, zoomLevel, height }: PdfSliderCompareProps) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const sliderDragging = useRef(false);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Calculate slider % relative to the inner content, accounting for scroll
  const updateSlider = useCallback((clientX: number) => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const containerRect = container.getBoundingClientRect();
    const xInContainer = clientX - containerRect.left;
    // Account for scroll position to get position within the full inner content
    const xInContent = xInContainer + container.scrollLeft;
    const contentWidth = inner.offsetWidth;
    const pct = Math.max(0, Math.min(100, (xInContent / contentWidth) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    // Check if clicking near the slider handle (within 20px)
    const containerRect = container.getBoundingClientRect();
    const xInContainer = e.clientX - containerRect.left;
    const xInContent = xInContainer + container.scrollLeft;
    const contentWidth = inner.offsetWidth;
    const sliderX = (sliderPos / 100) * contentWidth;
    const isNearSlider = Math.abs(xInContent - sliderX) < 20;

    if (isNearSlider || e.button === 0) {
      // Left click near slider or on content → move slider
      sliderDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateSlider(e.clientX);
    }
  }, [updateSlider, sliderPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (sliderDragging.current) {
      updateSlider(e.clientX);
    }
  }, [updateSlider]);

  const handlePointerUp = useCallback(() => {
    sliderDragging.current = false;
  }, []);

  // Pan with middle mouse button or when holding space (via mousedown)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button for panning
    if (e.button === 1) {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      panning.current = true;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      container.style.cursor = "grabbing";
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning.current) {
      const container = containerRef.current;
      if (!container) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      container.scrollLeft = panStart.current.scrollLeft - dx;
      container.scrollTop = panStart.current.scrollTop - dy;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (panning.current) {
      panning.current = false;
      const container = containerRef.current;
      if (container) container.style.cursor = "";
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto border rounded-lg bg-muted/20 select-none"
      style={{ height: height || "calc(100vh - 200px)", cursor: "col-resize" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Labels - fixed to container viewport */}
      <div className="pointer-events-none sticky top-0 left-0 z-20 flex justify-between p-2">
        <span className="bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded font-medium">Newer (A)</span>
        <span className="bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded font-medium">Older (B)</span>
      </div>

      <div ref={innerRef} style={{ width: `${zoomLevel * 100}%` }} className="relative">
        {/* Bottom layer: Document B (Older) */}
        <img
          src={imageB}
          alt="Document B (Older)"
          className="w-full block"
          draggable={false}
        />

        {/* Top layer: Document A (Newer) - clipped */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={imageA}
            alt="Document A (Newer)"
            className="w-full block"
            draggable={false}
          />
        </div>

        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 w-1 shadow-lg pointer-events-none"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)", backgroundColor: "hsl(var(--slider-handle))" }}
        >
          <div className="sticky top-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-md" style={{ marginLeft: '0.125rem', backgroundColor: "hsl(var(--slider-handle))" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "hsl(var(--slider-handle-foreground))" }}>
              <path d="M5 3L2 8L5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 3L14 8L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfSliderCompare;
