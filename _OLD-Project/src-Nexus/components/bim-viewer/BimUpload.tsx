import { useRef, useState } from "react";
import { Upload, Loader2, Plus } from "lucide-react";
import { useDigitalTwinStore, BimModel, IfcElement } from "@/store/useDigitalTwinStore";
import { toast } from "sonner";
import { useCanEdit } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Import a new model into the federated project view. Each upload becomes
 * its own BimModel — existing models are preserved. Editors/admins only.
 */
export function BimUpload({ compact = false }: { compact?: boolean } = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const addModel = useDigitalTwinStore((s) => s.addModel);
  const projectId = useDigitalTwinStore((s) => s.activeProjectId);
  const canEdit = useCanEdit("bim");

  if (!canEdit) return null;

  async function onFile(file: File) {
    setBusy(true);
    try {
      const modelId = (crypto as { randomUUID?: () => string }).randomUUID?.() ?? Math.random().toString(36).slice(2);
      const name = file.name.toLowerCase();
      if (name.endsWith(".ifcjson") || name.endsWith(".json")) {
        const text = await file.text();
        const json = JSON.parse(text);
        const elements = normalizeJsonElements(json, modelId);
        const model: BimModel = {
          id: modelId,
          name: file.name,
          fileType: "ifcjson",
          visible: true,
          elements,
        };
        addModel(model);
        toast.success(`Loaded ${elements.length} elements from ${file.name}`);
        await publishToCloud(projectId, modelId, file, "ifcjson");
      } else if (name.endsWith(".frag")) {
        const buf = await file.arrayBuffer();
        const model: BimModel = {
          id: modelId,
          name: file.name,
          fileType: "frag",
          visible: true,
          buffer: buf,
          elements: [],
        };
        addModel(model);
        toast.success(`Loading FRAG model ${file.name}…`);
        await publishToCloud(projectId, modelId, file, "frag");
      } else if (name.endsWith(".ifc")) {
        toast.info("Converting IFC to FRAG (first time may take a few seconds)…");
        const buf = await file.arrayBuffer();
        const { IfcImporter } = await import("@thatopen/fragments");
        const importer = new IfcImporter();
        // Host web-ifc.wasm from the public unpkg CDN matching our bundled version.
        importer.wasm = { path: "https://unpkg.com/web-ifc@0.0.77/", absolute: true };
        const fragBytes: Uint8Array = await importer.process({ bytes: new Uint8Array(buf) });
        const fragBuffer = fragBytes.buffer.slice(
          fragBytes.byteOffset,
          fragBytes.byteOffset + fragBytes.byteLength,
        ) as ArrayBuffer;
        const model: BimModel = {
          id: modelId,
          name: file.name.replace(/\.ifc$/i, ".frag"),
          fileType: "frag",
          visible: true,
          buffer: fragBuffer,
          elements: [],
        };
        addModel(model);
        toast.success(`Imported IFC → ${(fragBytes.byteLength / 1024).toFixed(0)} KB FRAG`);
        const convertedFile = new File([fragBuffer], model.name, { type: "application/octet-stream" });
        await publishToCloud(projectId, modelId, convertedFile, "frag");
      } else {
        toast.error("Unsupported file type. Use .frag, .ifcjson or .json");
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    try {
      for (const f of list) {
        try {
          await onFile(f);
        } catch (err) {
          console.error(`[bim] failed to load ${f.name}`, err);
          toast.error(`${f.name}: ${(err as Error).message}`);
        }
      }
      if (list.length > 1) toast.success(`Imported ${list.length} files`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".frag,.ifc,.ifcjson,.json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
        }}
      />
      {compact ? (
        <button
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Import Model
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Loading…" : "Load IFC / FRAG"}
        </button>
      )}
    </>
  );
}

async function publishToCloud(
  projectId: string | null,
  modelId: string,
  file: File,
  fileType: "frag" | "ifcjson",
) {
  if (!projectId) return;
  try {
    const ext = fileType === "frag" ? "frag" : "json";
    const path = `${projectId}/${modelId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("bim-models")
      .upload(path, file, { upsert: true, contentType: "application/octet-stream" });
    if (upErr) throw upErr;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { error: rowErr } = await supabase
      .from("project_bim_models")
      .upsert(
        {
          project_id: projectId,
          model_id: modelId,
          storage_path: path,
          original_name: file.name,
          file_type: fileType,
          updated_by: uid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,model_id" },
      );
    if (rowErr) throw rowErr;
    toast.success("Published to project — visible to all members");
  } catch (err) {
    console.error("[bim] publish failed", err);
    toast.error(`Failed to publish: ${(err as Error).message}`);
  }
}

function normalizeJsonElements(raw: unknown, modelId: string): IfcElement[] {
  const r = raw as Record<string, unknown>;
  const elementsRaw = (r.elements ?? r.items ?? []) as unknown[];
  return elementsRaw.map((e, i) => {
    const o = e as Record<string, unknown>;
    const pos = (o.position as number[] | undefined) ?? [0, (i % 5) * 1.2, Math.floor(i / 5) * 1.5];
    const size = (o.size as number[] | undefined) ?? [1, 1, 1];
    const rawId = (o.id as string) ?? `JSON-${i.toString().padStart(3, "0")}`;
    return {
      id: `${modelId}::${rawId}`,
      name: (o.name as string) ?? `Element ${i + 1}`,
      type: (o.type as string) ?? "IfcBuildingElement",
      position: [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0],
      size: [size[0] ?? 1, size[1] ?? 1, size[2] ?? 1],
      color: (o.color as string) ?? "#94a3b8",
      properties: (o.properties as Record<string, string | number>) ?? {},
      mqttTopic: o.mqttTopic as string | undefined,
    };
  });
}
