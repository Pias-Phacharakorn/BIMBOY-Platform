import React, { useState } from "react";
import { Icon, type AppIconName } from "@/react-components/components/ui";

interface PanelSectionProps {
  label: string;
  icon?: AppIconName;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function PanelSection({
  label,
  icon,
  children,
  defaultOpen = true,
  actions,
  className = "",
}: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`flex flex-col border-b border-border last:border-b-0 ${className}`}>
      {/* Section Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3.5 bg-bg hover:bg-surface-alt transition-colors duration-120 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-muted text-xs font-semibold tracking-wider uppercase">
          {icon && <Icon name={icon} size={14} className="text-accent-2" />}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2 text-muted hover:text-fg transition-colors" onClick={(e) => e.stopPropagation()}>
          {actions}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-center p-0.5 rounded hover:bg-surface transition-colors cursor-pointer"
            type="button"
            title={isOpen ? "Collapse Section" : "Expand Section"}
          >
            <Icon
              name="RIGHT"
              size={12}
              className={`transform transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          isOpen ? "max-h-[1000px] opacity-100 p-4" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
