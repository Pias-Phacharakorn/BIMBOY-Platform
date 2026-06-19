import { supabase } from "@/integrations/supabase/client";

const BUCKET = "bim-files";

export async function uploadBimFile(projectId: string, file: File, suffix = "ifc") {
  const ext = suffix.startsWith(".") ? suffix : `.${suffix}`;
  const id = crypto.randomUUID();
  const path = `${projectId}/${id}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { path, id };
}

export async function uploadBimBuffer(path: string, buffer: ArrayBuffer | Uint8Array) {
  const ab = buffer instanceof Uint8Array ? buffer.slice().buffer : buffer;
  const blob = new Blob([ab as ArrayBuffer], { type: "application/octet-stream" });
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true });
  if (error) throw error;
  return path;
}

export async function downloadBimBuffer(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteBimFiles(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

export async function getSignedBimUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
