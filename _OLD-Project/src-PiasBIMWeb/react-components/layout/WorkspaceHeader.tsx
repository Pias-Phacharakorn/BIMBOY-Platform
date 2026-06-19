import type { ReactNode } from "react";
import { UserAccountDropdown } from "../components/UserAccountDropdown";

interface WorkspaceHeaderProps {
  title: string;
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  actions?: ReactNode;
}

export function WorkspaceHeader({ title, tabs, activeTab, onTabChange, actions }: WorkspaceHeaderProps) {
  return (
    <header className="header">
      <div className="workspace-header-left">
        <div className="workspace-title">{title}</div>
        {tabs ? (
          <div className="workspace-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`tab ${tab === activeTab ? "active" : ""}`}
                type="button"
                onClick={() => onTabChange?.(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="workspace-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {actions}
        <UserAccountDropdown />
      </div>
    </header>
  );
}

