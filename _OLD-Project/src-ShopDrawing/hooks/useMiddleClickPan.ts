import { useRef, useCallback } from "react";

export function useMiddleClickPan() {
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
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

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panning.current) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
    container.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
  }, []);

  const onMouseUp = useCallback(() => {
    if (panning.current) {
      panning.current = false;
      if (containerRef.current) containerRef.current.style.cursor = "";
    }
  }, []);

  return {
    containerRef,
    panHandlers: { onMouseDown, onMouseMove, onMouseUp },
  };
}
