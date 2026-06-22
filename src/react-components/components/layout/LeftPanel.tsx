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
      {/* Header Container (Standard 58px Height) */}
      <div className={`flex items-center h-[58px] border-b border-border bg-bg px-3.5 ${isOpen ? "justify-end" : "justify-center"}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center h-8 w-8 rounded hover:bg-surface-alt text-muted hover:text-fg transition-colors cursor-pointer"
          type="button"
          title={isOpen ? "Collapse Panel" : "Expand Panel"}
        >
          <Icon name={isOpen ? "PANEL_LEFT_CLOSE" : "PANEL_LEFT_OPEN"} size={20} />
        </button>
      </div>

      {/* Content Area */}
      {isOpen ? (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="w-full h-full flex flex-col gap-3">
            {children}
          </div>
        </div>
      ) : (
        /* Collapsed Icon Strip Indicator */
        <div className="flex flex-col items-center gap-4 py-4 text-muted">
          <Icon name={icon} size={20} className="opacity-70 hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}
