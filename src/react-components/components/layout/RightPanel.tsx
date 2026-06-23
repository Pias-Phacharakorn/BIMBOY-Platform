import React, { useState, useRef, useEffect } from "react";
import { Icon, type AppIconName } from "@/react-components/components/ui";

interface RightPanelProps {
  icon?: AppIconName;
  children?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function RightPanel({
  icon = "SETTINGS",
  children,
  className = "",
  defaultOpen = true,
}: RightPanelProps) {
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
      const newWidth = rect.right - e.clientX;
      const maxWidth = Math.min(600, window.innerWidth / 2);

      if (newWidth > 48) {
        setIsOpen(true);
        if (newWidth < 200) {
          setWidth(newWidth);
        } else {
          setWidth(Math.min(maxWidth, Math.max(320, newWidth)));
        }
      } else {
        setIsOpen(false);
        setWidth(48);
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
      style={{ width: isOpen ? `${width}px` : "48px" }}
      className={`relative z-10 flex flex-col h-full border-l border-border bg-surface/94 backdrop-blur-md ${
        isDragging ? "" : "transition-[width] duration-180 ease-in-out"
      } ${className}`}
    >
      {/* Content Area */}
      {isOpen ? (
        <div className="flex-1 overflow-y-auto">
          <div className="w-full h-full flex flex-col">
            {children}
          </div>
        </div>
      ) : (
        /* Collapsed Icon Strip Indicator */
        <div className="flex-1 flex flex-col items-center gap-4 py-4 text-muted overflow-y-auto">
          <Icon name={icon} size={20} className="opacity-70 hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Drag handle */}
      <div
        onMouseDown={startDrag}
        className="absolute top-0 left-0 -ml-1 w-2 h-full cursor-col-resize z-20 group"
      >
        <div className="absolute left-0 top-0 w-[2px] h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      </div>

      {/* Footer Container (Standard 48px Height containing the collapse button) */}
      <div className={`flex items-center h-[48px] border-t border-border bg-bg px-3.5 flex-none ${isOpen ? "justify-end" : "justify-center"}`}>
        <button
          onClick={() => {
            if (!isOpen) {
              setWidth(320); // Ensure it opens to default width
            }
            setIsOpen(!isOpen);
          }}
          className="flex items-center justify-center h-7 w-7 rounded hover:bg-surface-alt text-muted hover:text-fg transition-colors cursor-pointer"
          type="button"
          title={isOpen ? "Collapse Panel" : "Expand Panel"}
        >
          <Icon name={isOpen ? "PANEL_RIGHT_CLOSE" : "PANEL_RIGHT_OPEN"} size={16} />
        </button>
      </div>
    </div>
  );
}

