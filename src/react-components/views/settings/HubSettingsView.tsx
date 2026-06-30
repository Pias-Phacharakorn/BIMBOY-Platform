import { Link } from "@tanstack/react-router";
import { Icon } from "@/react-components/components/ui";
import { UserAccountDropdown } from "@/react-components/features/auth/UserAccountDropdown";
import { HubSettings } from "@/react-components/features/hub-settings/HubSettings";

export function HubSettingsView() {
  return (
    <div className="flex w-screen h-screen min-w-0 bg-[#090a0f] flex-col">
      {/* Page Header */}
      <header className="relative z-20 flex flex-none items-center justify-between gap-[18px] min-h-[58px] px-[clamp(14px,2vw,24px)] bg-[oklch(12.2%_0.014_255_/_92%)] border-b border-border backdrop-blur-md">
        <div className="flex items-center gap-2.5 text-fg font-semibold text-lg tracking-tight select-none">
          <Link
            to="/projects"
            className="inline-flex items-center justify-center w-8 h-8 rounded-radius border border-border bg-transparent text-muted hover:border-border-strong hover:bg-surface-raised hover:text-fg transition-all duration-120 cursor-pointer no-underline"
            title="Back to Projects"
          >
            <Icon name="CHEVRON_LEFT" size={16} />
          </Link>
          <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-accent to-accent-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_26px_rgba(102,126,234,0.18)]" />
          <span>BIM BOY</span>
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider bg-accent-muted/10 border border-accent/20 px-2 py-0.5 rounded ml-2 select-none">
            Hub Admin
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <UserAccountDropdown />
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="p-[32px] flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-fg">Hub Administration</h1>
            <p className="text-muted text-sm">
              Configure global access permissions, register user accounts, and promote administrative roles across your shared workspace.
            </p>
          </div>

          <HubSettings />
        </div>
      </main>
    </div>
  );
}
