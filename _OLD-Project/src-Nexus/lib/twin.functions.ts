import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// ---------- MQTT topic <-> element mappings ----------

export const listMqttMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("mqtt_mappings")
      .select("element_id, topic")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ elementId: r.element_id, topic: r.topic }));
  });

export const upsertMqttMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        elementId: z.string().min(1).max(255),
        topic: z.string().min(1).max(512),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("mqtt_mappings")
      .upsert(
        {
          user_id: userId,
          project_id: data.projectId,
          element_id: data.elementId,
          topic: data.topic,
        },
        { onConflict: "project_id,element_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMqttMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        elementId: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("mqtt_mappings")
      .delete()
      .eq("project_id", data.projectId)
      .eq("element_id", data.elementId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- BIM model cleanup ----------

export const removeBimModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        modelId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { data: row, error: rowError } = await supabase
      .from("project_bim_models")
      .select("storage_path")
      .eq("project_id", data.projectId)
      .eq("model_id", data.modelId)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);

    const storagePath = row?.storage_path;
    if (storagePath && storagePath.startsWith(`${data.projectId}/`)) {
      const { error: storageError } = await supabase.storage
        .from("bim-models")
        .remove([storagePath]);
      if (storageError) throw new Error(storageError.message);
    }

    const { error: mappingError } = await supabase
      .from("mqtt_mappings")
      .delete()
      .eq("project_id", data.projectId)
      .like("element_id", `${data.modelId}::%`);
    if (mappingError) throw new Error(mappingError.message);

    const { error: deleteError } = await supabase
      .from("project_bim_models")
      .delete()
      .eq("project_id", data.projectId)
      .eq("model_id", data.modelId);
    if (deleteError) throw new Error(deleteError.message);

    return { ok: true, storagePath: storagePath ?? null };
  });

// ---------- Workflow config (React Flow) ----------

const NodeSchema = z
  .object({
    id: z.string(),
    type: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

const EdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  })
  .passthrough();

export const getWorkflowConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("workflow_configs")
      .select("nodes, edges")
      .eq("project_id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      nodes: (row.nodes ?? []) as Json,
      edges: (row.edges ?? []) as Json,
    };
  });

export const saveWorkflowConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        nodes: z.array(NodeSchema).max(500),
        edges: z.array(EdgeSchema).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("workflow_configs")
      .upsert(
        {
          user_id: userId,
          project_id: data.projectId,
          nodes: data.nodes as unknown as Json,
          edges: data.edges as unknown as Json,
        },
        { onConflict: "project_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });