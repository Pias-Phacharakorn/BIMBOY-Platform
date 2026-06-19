import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clash } from "@/components/clash/clashTypes";

export const useClashes = (projectId: string | null) => {
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setClashes([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("clash_viewpoints")
      .select("*")
      .eq("project_id", projectId)
      .order("issue_number", { ascending: true });
    setClashes((data as unknown as Clash[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`clash-rt-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clash_viewpoints", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, load]);

  return { clashes, loading, reload: load };
};
