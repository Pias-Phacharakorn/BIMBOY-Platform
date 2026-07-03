import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppProject } from "@/types";

export type ShopDrawingRow = Database["public"]["Tables"]["shop_drawings"]["Row"];

const BUCKET = "project-files";

function sheetFolderPath(project: AppProject, sheetNo: string): string {
  return `${project.projectnumber}_${project.projectName}/04_Drawing/${sheetNo}`;
}

function buildPdfPath(project: AppProject, sheetNo: string, revision: number): string {
  return `${sheetFolderPath(project, sheetNo)}/Rev${revision}_${Date.now()}.pdf`;
}

async function uploadThenInsert(
  pdfPath: string,
  pdfFile: File,
  insertPayload: Database["public"]["Tables"]["shop_drawings"]["Insert"]
): Promise<ShopDrawingRow> {
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfFile, {
    upsert: true,
  });
  if (uploadError) {
    console.error(`Error uploading PDF to ${pdfPath}:`, uploadError);
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from("shop_drawings")
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    // Storage upload succeeded but the row failed — best-effort cleanup so a
    // retry doesn't leave a permanently orphaned object under this exact path.
    await supabase.storage.from(BUCKET).remove([pdfPath]);
    console.error(`Error inserting shop_drawings row for ${pdfPath}:`, insertError);
    throw insertError;
  }

  return data;
}

export const shopDrawingsService = {
  async listShopDrawings(projectId: string): Promise<ShopDrawingRow[]> {
    const { data, error } = await supabase
      .from("shop_drawings")
      .select("*")
      .eq("project_id", projectId)
      .order("sheet_no", { ascending: true })
      .order("revision", { ascending: false });

    if (error) {
      console.error(`Error fetching shop drawings for project ${projectId}:`, error);
      throw error;
    }
    return data || [];
  },

  async createShopDrawing(args: {
    project: AppProject;
    sheetNo: string;
    sheetName: string;
    author: string | null;
    pdfFile: File;
    createdBy: string | null;
  }): Promise<ShopDrawingRow> {
    const revision = 0;
    const pdfPath = buildPdfPath(args.project, args.sheetNo, revision);
    return uploadThenInsert(pdfPath, args.pdfFile, {
      project_id: args.project.id,
      sheet_no: args.sheetNo,
      sheet_name: args.sheetName,
      author: args.author,
      revision,
      pdf_path: pdfPath,
      created_by: args.createdBy,
    });
  },

  async addRevision(args: {
    project: AppProject;
    sheetNo: string;
    sheetName: string;
    author: string | null;
    revision: number;
    pdfFile: File;
    createdBy: string | null;
  }): Promise<ShopDrawingRow> {
    const pdfPath = buildPdfPath(args.project, args.sheetNo, args.revision);
    return uploadThenInsert(pdfPath, args.pdfFile, {
      project_id: args.project.id,
      sheet_no: args.sheetNo,
      sheet_name: args.sheetName,
      author: args.author,
      revision: args.revision,
      pdf_path: pdfPath,
      created_by: args.createdBy,
    });
  },

  async deleteShopDrawing(row: { id: string; pdfPath: string }): Promise<void> {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.pdfPath]);
    if (storageError) {
      console.error(`Error removing storage object ${row.pdfPath}:`, storageError);
      throw storageError;
    }

    const { error: deleteError } = await supabase.from("shop_drawings").delete().eq("id", row.id);
    if (deleteError) {
      console.error(`Error deleting shop_drawings row ${row.id}:`, deleteError);
      throw deleteError;
    }
  },

  getPdfPublicUrl(pdfPath: string): string {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(pdfPath);
    return data.publicUrl;
  },
};
