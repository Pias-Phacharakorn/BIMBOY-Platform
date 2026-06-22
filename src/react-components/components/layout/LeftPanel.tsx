import React, { useState } from "react";
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

  return (
    <div
      className={`relative z-10 flex flex-col h-full border-r border-border bg-surface/94 backdrop-blur-md transition-all duration-180 ease-in-out ${
        isOpen ? "w-[320px]" : "w-[48px]"
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

      {/* Footer Container (Standard 48px Height containing the collapse button) */}
      <div className={`flex items-center h-[48px] border-t border-border bg-bg px-3.5 flex-none ${isOpen ? "justify-end" : "justify-center"}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center h-7 w-7 rounded hover:bg-surface-alt text-muted hover:text-fg transition-colors cursor-pointer"
          type="button"
          title={isOpen ? "Collapse Panel" : "Expand Panel"}
        >
          <Icon name={isOpen ? "PANEL_LEFT_CLOSE" : "PANEL_LEFT_OPEN"} size={16} />
        </button>
      </div>
    </div>
  );
}
