import React, { useState, useRef } from "react";
import { Icon, type AppIconName } from "@/react-components/components/ui";

interface PanelSectionProps {
  label: string;
  icon?: AppIconName;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  className?: string;
  onSearch?: (query: string) => void;
}

export function PanelSection({
  label,
  icon,
  children,
  defaultOpen = true,
  actions,
  className = "",
  onSearch,
}: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSearching) {
      // Close search and reset filter list
      setSearchText("");
      onSearch?.("");
      setIsSearching(false);
    } else {
      // Open search and auto-expand section content
      setIsSearching(true);
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <div className={`flex flex-col border-b border-border last:border-b-0 ${className}`}>
      {/* Section Header */}
      <div
        onClick={() => !isSearching && setIsOpen(!isOpen)}
        className={`flex items-center justify-between p-3.5 bg-bg hover:bg-surface-alt transition-colors duration-120 select-none ${
          isSearching ? "cursor-default" : "cursor-pointer"
        }`}
      >
        {isSearching ? (
          /* Search Input Mode (Mockup Aligned Underline styling) */
          <div className="flex-1 flex items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={handleInputChange}
              placeholder="filter..."
              className="w-full bg-transparent text-fg text-xs font-semibold py-0.5 border-b border-border-strong focus:border-accent focus:outline-none placeholder-muted-2"
            />
          </div>
        ) : (
          /* Normal Title Mode */
          <div className="flex items-center gap-2 text-muted text-xs font-semibold tracking-wider uppercase">
            {icon && <Icon name={icon} size={14} className="text-accent-2" />}
            <span>{label}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted hover:text-fg transition-colors" onClick={(e) => e.stopPropagation()}>
          {actions}
          {onSearch ? (
            /* Search Toggle Button */
            <button
              onClick={handleSearchToggle}
              className="flex items-center justify-center p-0.5 rounded hover:bg-surface transition-colors cursor-pointer"
              type="button"
              title={isSearching ? "Close Search" : "Search"}
            >
              <Icon name="SEARCH" size={14} className={isSearching ? "text-accent-2" : ""} />
            </button>
          ) : (
            /* Standard Collapse Toggle Button */
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
          )}
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
