import type { ReactNode } from "react";
import { UserAccountDropdown } from "@/react-components/features/auth/UserAccountDropdown";

interface WorkspaceHeaderProps {
  title: string;
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  actions?: ReactNode;
}

export function WorkspaceHeader({ title, tabs, activeTab, onTabChange, actions }: WorkspaceHeaderProps) {
  return (
    <header className="relative z-20 flex flex-none items-center justify-between gap-[18px] min-h-[58px] px-[clamp(14px,2vw,24px)] bg-[oklch(12.2%_0.014_255_/_92%)] border-b border-border backdrop-blur-md">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex-none text-[15px] font-semibold text-fg">{title}</div>
        {tabs ? (
          <div className="flex gap-[3px] max-w-full overflow-x-auto p-[3px] border border-border rounded-radius bg-[oklch(10.5%_0.014_255)] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`flex-none px-[11px] py-[5px] border rounded-radius-sm cursor-pointer text-xs font-semibold whitespace-nowrap transition-all duration-120 ${
                  tab === activeTab
                    ? "bg-[oklch(24%_0.038_252)] border-[oklch(45%_0.07_252)] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-transparent text-muted hover:bg-surface-alt hover:text-fg"
                }`}
                type="button"
                onClick={() => onTabChange?.(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3 min-w-0">
        {actions}
        {actions ? <div className="w-[1px] h-4 bg-border/60 mx-1" /> : null}
        <UserAccountDropdown />
      </div>
    </header>
  );
}


