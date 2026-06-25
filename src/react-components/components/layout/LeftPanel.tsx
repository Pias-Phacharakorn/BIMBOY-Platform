import React, { useState, useRef, useEffect } from "react";
import { Icon, type AppIconName } from "@/react-components/components/ui";

interface LeftPanelProps {
  icon?: AppIconName;
  children?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function LeftPanel({
  icon = "LAYOUT",
  children,
  className = "",
  defaultOpen = true,
}: LeftPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [width, setWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(width);

  // Keep widthRef in sync with width state
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const maxWidth = Math.min(600, window.innerWidth / 2);

      if (newWidth > 20) {
        setIsOpen(true);
        if (newWidth < 200) {
          setWidth(newWidth);
        } else {
          setWidth(Math.min(maxWidth, Math.max(320, newWidth)));
        }
      } else {
        setIsOpen(false);
        setWidth(320); // Reset width state to default for next open
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const currentWidth = widthRef.current;
      if (currentWidth < 200) {
        setIsOpen(false);
        setWidth(320); // Reset width state to default for next open
      } else if (currentWidth < 320) {
        setWidth(320); // Snap back to minimum
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={panelRef}
      style={{ width: isOpen ? `${width}px` : "0px" }}
      className={`relative z-10 flex flex-col h-full flex-none bg-surface/94 backdrop-blur-md transition-[border-color] duration-150 ${
        isOpen ? "border-r border-border" : "border-r-transparent"
      } ${
        isDragging ? "" : "transition-[width] duration-180 ease-in-out"
      } ${className}`}
    >
      {/* Content Area Wrapper to enable sliding and clip children */}
      <div className="flex-1 overflow-hidden w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto min-w-[320px] h-full flex flex-col">
          {children}
        </div>
      </div>

      {/* Full-height drag target & hover highlight */}
      {isOpen && (
        <div
          onMouseDown={startDrag}
          className="absolute top-0 right-0 -mr-1.5 w-3 h-full cursor-col-resize z-20 group select-none"
          title="Drag to resize"
        >
          {/* Glowing vertical line */}
          <div className="absolute right-[5px] top-0 w-[2px] h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          
          {/* Centered Grip Pill */}
          <div
            className="absolute top-1/2 right-[5px] translate-x-[6px] -translate-y-1/2 flex items-center justify-center pointer-events-none"
          >
            <div className="flex gap-[3px] py-1.5 px-1 bg-surface border border-border rounded shadow-md opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-[1.5px] h-3 bg-muted-2 rounded-full" />
              <div className="w-[1.5px] h-3 bg-muted-2 rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button (positioned completely outside the panel border) */}
      <button
        onClick={() => {
          if (!isOpen) {
            setWidth(320); // Ensure it opens to default width
          }
          setIsOpen(!isOpen);
        }}
        className="absolute top-1/2 left-full -translate-y-1/2 z-30 flex items-center justify-center h-10 w-6 bg-surface border border-border border-l-0 rounded-r-lg shadow-lg cursor-pointer hover:bg-surface-alt transition-colors text-muted hover:text-fg select-none"
        type="button"
        title={isOpen ? "Collapse Panel" : "Expand Panel"}
      >
        <Icon name={isOpen ? "CHEVRON_LEFT" : "CHEVRON_RIGHT"} size={14} />
      </button>
    </div>
  );
}

