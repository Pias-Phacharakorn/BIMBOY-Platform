import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveProject {
  id: string;
  name: string;
}

interface ActiveProjectContextValue {
  projects: ActiveProject[];
  selectedProject: string;
  setSelectedProject: (id: string) => void;
  current: ActiveProject | null;
  refresh: () => Promise<void>;
  loading: boolean;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

const STORAGE_KEY = "lastSelectedProject";

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );
  const [loading, setLoading] = useState(true);

  const setSelectedProject = useCallback((id: string) => {
    setSelectedProjectState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const { data: memberData } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    if (!memberData || memberData.length === 0) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const ids = memberData.map((m) => m.project_id);
    const { data: pj } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", ids);
    const list = pj || [];
    setProjects(list);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && list.some((p) => p.id === saved)) {
      setSelectedProjectState(saved);
    } else if (list.length > 0) {
      setSelectedProjectState(list[0].id);
      localStorage.setItem(STORAGE_KEY, list[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const current = projects.find((p) => p.id === selectedProject) || null;

  return (
    <ActiveProjectContext.Provider value={{ projects, selectedProject, setSelectedProject, current, refresh, loading }}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error("useActiveProject must be used within ActiveProjectProvider");
  return ctx;
}
