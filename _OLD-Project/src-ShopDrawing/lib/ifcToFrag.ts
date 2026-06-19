import { IfcImporter } from "@thatopen/fragments";

const WEB_IFC_WASM = "https://unpkg.com/web-ifc@0.0.77/";

// Marker suffix kept for backward compatibility with rows already written
// to the database. New conversions use the default importer settings, which
// keep models visible AND let FragmentsModels.autoCoordinate align federated
// models against the first one (matching Revit/IFC shared coordinates).
export const WORLD_FRAG_SUFFIX = ".frag";

export function getWorldFragPath(projectId: string, modelId: string) {
  return `${projectId}/${modelId}.frag`;
}

export function isWorldFragPath(path: string | null | undefined) {
  return !!path && path.endsWith(".frag");
}

export async function convertIfcToWorldFrag(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const importer = new IfcImporter();
  importer.wasm = { path: WEB_IFC_WASM, absolute: true };
  const sourceBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return importer.process({ bytes: sourceBytes });
}
