import { AppSidebar } from "./AppSidebar";
import { Bell } from "lucide-react";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { useMockMqtt } from "@/hooks/useMockMqtt";
import { useProjectContext } from "@/hooks/useProjectContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  useMockMqtt();
  // Keep the user's project context (role + projects) loaded everywhere.
  useProjectContext();
  const alertCount = Object.keys(useDigitalTwinStore((s) => s.alertStates)).length;
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/60 px-6 backdrop-blur">
          <div>
            <h2 className="text-sm font-semibold">Digital Twin Platform</h2>
            <p className="text-xs text-muted-foreground">BIM · IoT · Workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {alertCount}
                </span>
              )}
            </div>
            <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold">
              DT
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}