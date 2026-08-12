import type { CloudFragFile } from "@/react-components/features/cloud-models/cloudModelsService";
import { DEMO_ASSET_PREFIX } from "./demoProject";

/**
 * Static counterpart to `cloudModelsService`: the same two operations (list,
 * download) served from `public/resources/demo/` instead of Supabase storage.
 * Returning `CloudFragFile` lets the demo reuse `useLoadCloudModelBatch`, which
 * owns the first-load serialisation required by ADR-0015 plus the progress modal
 * and Stop button.
 *
 * A static host cannot list a directory, hence the hand-maintained manifest.
 */

interface DemoManifestEntry {
  /** File name inside public/resources/demo, e.g. "architecture.frag". */
  file: string;
  /** Optional display name; defaults to the file name without its extension. */
  label?: string;
}

interface DemoManifest {
  models: DemoManifestEntry[];
}

export const demoModelsService = {
  /** Reads the manifest and maps it to the shape the shared batch loader expects. */
  async listDemoFrags(): Promise<CloudFragFile[]> {
    const response = await fetch(`${DEMO_ASSET_PREFIX}/manifest.json`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(
        `Demo manifest not found at ${DEMO_ASSET_PREFIX}/manifest.json (HTTP ${response.status})`
      );
    }

    const manifest = (await response.json()) as DemoManifest;
    const entries = Array.isArray(manifest?.models) ? manifest.models : [];

    return entries
      .filter((entry) => typeof entry?.file === "string" && entry.file.toLowerCase().endsWith(".frag"))
      .map((entry) => ({
        name: entry.file,
        modelId: entry.label?.trim() || entry.file.replace(/\.frag$/i, ""),
        size: 0,
        updatedAt: "",
        revitVersion: "",
      }));
  },

  /**
   * Fetches one .frag as bytes. Signature matches
   * `cloudModelsService.downloadFragFile` so it can be injected into the shared
   * loader as a drop-in replacement.
   */
  async downloadDemoFrag(
    prefix: string,
    fileName: string,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const url = `${prefix}/${encodeURIComponent(fileName)}`;
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch demo model "${url}" (HTTP ${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  },
};
