import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationSettings } from "@/components/NotificationSettings";
import { AppSidebar } from "./AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useActiveProject } from "@/hooks/useActiveProject";

export function AppHeader() {
  const [profile, setProfile] = useState<{ first_name: string; last_name: string } | null>(null);
  const { role } = useUserRole();
  const { current } = useActiveProject();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, []);

  const initials = profile
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() || "U"
    : "U";
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : "User";

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 md:px-6 py-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="min-w-0">
          {current && (
            <>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project</p>
              <p className="text-sm font-medium truncate max-w-[60vw] md:max-w-md">{current.name}</p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationSettings />
        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{role || "member"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
