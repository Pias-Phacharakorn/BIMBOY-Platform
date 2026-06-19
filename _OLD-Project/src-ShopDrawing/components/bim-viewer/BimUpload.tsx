import { useRef, useState } from "react";
import { Upload, Loader2, Plus } from "lucide-react";
import { useDigitalTwinStore, BimModel } from "@/store/useDigitalTwinStore";
import { toast } from "sonner";
import { useCanEdit } from "@/hooks/useCanEdit";
import { supabase } from "@/integrations/supabase/client";
import { uploadBimFile, uploadBimBuffer } from "@/lib/bimStorage";
import { convertIfcToWorldFrag, getWorldFragPath } from "@/lib/ifcToFrag";

/**
 * Upload an IFC / FRAG file and add it as a federated BimModel for the
 * active project. Persists to the existing `bim_models` table + `bim-files`
 * storage bucket. Editors / admins only.
 */
export function BimUpload({ compact = false }: { compact?: boolean } = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const addModel = useDigitalTwinStore((s) => s.addModel);
  const projectId = useDigitalTwinStore((s) => s.activeProjectId);
  const canEdit = useCanEdit();

  if (!canEdit) return null;

  async function onFile(file: File) {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".frag")) {
        const buf = await file.arrayBuffer();
        const { path } = await uploadBimFile(projectId, file, "frag");
        const modelId = await insertModelRow(projectId, file.name, file.size, null, path);
        addModel({
          id: modelId,
          name: file.name,
          fileType: "frag",
          visible: true,
          storagePath: path,
          buffer: buf,
          elements: [],
        });
        toast.success(`Loaded FRAG model ${file.name}`);
      } else if (name.endsWith(".ifc")) {
        toast.info("Converting IFC to FRAG (first time may take a few seconds)…");
        const buf = await file.arrayBuffer();
        const fragBytes = await convertIfcToWorldFrag(buf);
        const fragBuffer = fragBytes.buffer.slice(
          fragBytes.byteOffset,
          fragBytes.byteOffset + fragBytes.byteLength,
        ) as ArrayBuffer;

        // Upload the original IFC + cache the converted FRAG.
        const { path: ifcPath } = await uploadBimFile(projectId, file, "ifc");
        const modelId = await insertModelRow(projectId, file.name, file.size, ifcPath, null);
        const fragPath = getWorldFragPath(projectId, modelId);
        await uploadBimBuffer(fragPath, fragBuffer);
        await supabase.from("bim_models").update({ fragments_path: fragPath }).eq("id", modelId);

        const fragModel: BimModel = {
          id: modelId,
          name: file.name.replace(/\.ifc$/i, ".frag"),
          fileType: "frag",
          visible: true,
          storagePath: fragPath,
          buffer: fragBuffer,
          elements: [],
        };
        addModel(fragModel);
        toast.success(`Imported IFC → ${(fragBytes.byteLength / 1024).toFixed(0)} KB FRAG`);
      } else {
        toast.error("Unsupported file. Use .ifc or .frag");
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load: ${(err as Error).message}`);
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
        accept=".frag,.ifc"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          if (files.length === 1) {
            await onFile(files[0]);
          } else {
            toast.info(`Importing ${files.length} models…`);
            let ok = 0;
            for (const f of files) {
              try {
                await onFile(f);
                ok++;
              } catch (err) {
                console.error(err);
              }
            }
            toast.success(`Imported ${ok}/${files.length} models`);
          }
          if (inputRef.current) inputRef.current.value = "";
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

async function insertModelRow(
  projectId: string,
  name: string,
  size: number,
  ifcPath: string | null,
  fragPath: string | null,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("bim_models")
    .insert({
      project_id: projectId,
      name,
      file_size: size,
      ifc_path: ifcPath ?? "",
      fragments_path: fragPath,
      uploaded_by: uid,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
