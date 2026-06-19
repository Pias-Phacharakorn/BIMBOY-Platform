import { useEffect, useRef } from "react";
import { useDigitalTwinStore, BimModel } from "@/store/useDigitalTwinStore";
import { supabase } from "@/integrations/supabase/client";
import { downloadBimBuffer, uploadBimBuffer } from "@/lib/bimStorage";
import { convertIfcToWorldFrag, getWorldFragPath, isWorldFragPath } from "@/lib/ifcToFrag";

/**
 * Hydrate federated BIM models for the active project from the
 * existing `bim_models` table + `bim-files` storage bucket.
 *
 * - Prefer `fragments_path` when present (fast load).
 * - Otherwise fetch `ifc_path`, convert via @thatopen/fragments IfcImporter,
 *   then cache the resulting .frag back to storage for next time.
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
          .from("bim_models")
          .select("id, name, ifc_path, fragments_path, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (cancelled || !rows) return;
        for (const row of rows) {
          try {
            let buffer: ArrayBuffer | null = null;
            let storagePath: string | undefined;
            if (row.fragments_path) {
              try {
                const u8 = await downloadBimBuffer(row.fragments_path);
                buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
                storagePath = row.fragments_path;
              } catch (err) {
                console.warn(`[bim] cached fragments missing for ${row.name}, will reconvert`, err);
              }
            }
            if (!buffer && row.ifc_path) {
              try {
                const u8 = await downloadBimBuffer(row.ifc_path);
                const fragBytes = await convertIfcToWorldFrag(u8);
                buffer = fragBytes.buffer.slice(
                  fragBytes.byteOffset,
                  fragBytes.byteOffset + fragBytes.byteLength,
                ) as ArrayBuffer;
                const fragPath = getWorldFragPath(projectId, row.id);
                try {
                  await uploadBimBuffer(fragPath, buffer);
                  await supabase.from("bim_models").update({ fragments_path: fragPath }).eq("id", row.id);
                  storagePath = fragPath;
                } catch (err) {
                  console.warn("[bim] cache fragments failed", err);
                }
              } catch (err) {
                console.warn(`[bim] ifc reconvert failed for ${row.name}`, err);
              }
            }

            if (cancelled || !buffer) continue;
            const model: BimModel = {
              id: row.id,
              name: row.name,
              fileType: "frag",
              visible: true,
              storagePath,
              buffer,
              elements: [],
            };
            addModel(model);
          } catch (err) {
            console.warn(`[bim] failed to load model ${row.name}`, err);
          }
        }
      } catch (err) {
        console.warn("[bim] restore failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, addModel]);
}
