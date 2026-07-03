import { supabase } from "@/integrations/supabase/client";

export interface CloudFragFile {
  name: string;
  modelId: string;
  size: number;
  updatedAt: string;
  revitVersion: string;
}

function deriveRevitVersion(itemName: string, metadata: unknown): string {
  if (metadata) {
    const metaObj = metadata as any;
    if (metaObj.customMetadata) {
      for (const key of Object.keys(metaObj.customMetadata)) {
        if (key.toLowerCase().includes("revit")) {
          return metaObj.customMetadata[key];
        }
      }
    }
  }
  const match = itemName.match(/_R(\d{2})/i);
  return match ? "20" + match[1] : "";
}

export const cloudModelsService = {
  /**
   * Lists all .frag files under a project's storage prefix (e.g. "{projectnumber}_{projectName}/02_frag").
   */
  async listFragFiles(prefix: string): Promise<CloudFragFile[]> {
    const { data, error } = await supabase.storage
      .from("project-files")
      .list(prefix, {
        sortBy: { column: "name", order: "asc" },
        limit: 100,
      });

    if (error) {
      console.error(`Error listing frag files under "${prefix}":`, error);
      throw error;
    }

    return (data || [])
      .filter(
        (item) =>
          item.name !== ".emptyFolderPlaceholder" &&
          item.name.toLowerCase().endsWith(".frag")
      )
      .map((item) => ({
        name: item.name,
        modelId: item.name.replace(/\.frag$/i, ""),
        size: item.metadata?.size || 0,
        updatedAt: item.updated_at || item.created_at || "",
        revitVersion: deriveRevitVersion(item.name, item.metadata),
      }));
  },

  /**
   * Downloads a single .frag file's bytes from storage.
   */
  async downloadFragFile(prefix: string, fileName: string): Promise<Uint8Array> {
    const fullPath = `${prefix}/${fileName}`;
    const { data, error } = await supabase.storage
      .from("project-files")
      .download(fullPath);

    if (error) {
      console.error(`Error downloading frag file "${fullPath}":`, error);
      throw error;
    }
    if (!data) {
      throw new Error(`No data returned for "${fullPath}"`);
    }

    const buffer = await data.arrayBuffer();
    return new Uint8Array(buffer);
  },
};
