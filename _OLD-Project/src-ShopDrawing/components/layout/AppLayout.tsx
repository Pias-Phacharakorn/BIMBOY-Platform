import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { ActiveProjectProvider } from "@/hooks/useActiveProject";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "sidebarCollapsed";

export function AppLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) {
        setIsAuthed(false);
        navigate("/auth", { replace: true });
      } else {
        setIsAuthed(true);
      }
    });

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        setIsAuthed(true);
      }
      setAuthChecked(true);
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (!authChecked || !isAuthed) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <ActiveProjectProvider>
      <div className="flex h-screen overflow-hidden w-full">
        <div className="hidden md:flex">
          <AppSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </ActiveProjectProvider>
  );
}
