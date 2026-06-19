import { useEffect, useRef } from "react";
import { useDigitalTwinStore, BimModel } from "@/store/useDigitalTwinStore";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hydrates the federated BIM models for the active project from cloud
 * storage. Each row in `project_bim_models` becomes a BimModel; the
 * underlying .frag / .json file is downloaded on demand.
 *
 * IndexedDB caching is intentionally skipped here — FRAG buffers can be
 * large and the cloud download is fast enough on rehydrate.
 */
export function useBimPersistence() {
  const projectId = useDigitalTwinStore((s) => s.activeProjectId);
  const addModel = useDigitalTwinStore((s) => s.addModel);
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    if (restoredFor.current === projectId) return;
    restoredFor.current = projectId;

    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from("project_bim_models")
          .select("model_id, storage_path, original_name, file_type, updated_at")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: true });
        if (error) throw error;
        if (cancelled || !rows) return;
        for (const row of rows) {
          try {
            const { data: blob, error: dlErr } = await supabase.storage
              .from("bim-models")
              .download(row.storage_path);
            if (dlErr) throw dlErr;
            if (cancelled) return;
            if (row.file_type === "frag") {
              const buf = await blob.arrayBuffer();
              const model: BimModel = {
                id: row.model_id,
                name: row.original_name,
                fileType: "frag",
                visible: true,
                storagePath: row.storage_path,
                buffer: buf,
                elements: [],
              };
              addModel(model);
            } else {
              const text = await blob.text();
              const json = JSON.parse(text) as { elements?: unknown[] };
              const elements = (json.elements ?? []).map((e: unknown, i) => {
                const o = e as Record<string, unknown>;
                const pos = (o.position as number[] | undefined) ?? [0, 0, 0];
                const size = (o.size as number[] | undefined) ?? [1, 1, 1];
                const rawId = (o.id as string) ?? `JSON-${i}`;
                return {
                  id: `${row.model_id}::${rawId}`,
                  name: (o.name as string) ?? `Element ${i + 1}`,
                  type: (o.type as string) ?? "IfcBuildingElement",
                  position: [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0] as [number, number, number],
                  size: [size[0] ?? 1, size[1] ?? 1, size[2] ?? 1] as [number, number, number],
                  color: (o.color as string) ?? "#94a3b8",
                  properties: (o.properties as Record<string, string | number>) ?? {},
                  mqttTopic: o.mqttTopic as string | undefined,
                };
              });
              const model: BimModel = {
                id: row.model_id,
                name: row.original_name,
                fileType: "ifcjson",
                visible: true,
                storagePath: row.storage_path,
                elements,
              };
              addModel(model);
            }
          } catch (err) {
            console.warn(`[persistence] failed to load model ${row.original_name}`, err);
          }
        }
      } catch (err) {
        console.warn("[persistence] cloud restore failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, addModel]);
}
