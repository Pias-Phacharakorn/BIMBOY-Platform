import { useAuth } from "@/react-components/features/auth/useAuth";
import type { NewDrawingInput } from "@/react-components/components/shop-drawings/AddDrawingDialog";
import type { UploadRevisionInput } from "@/react-components/components/shop-drawings/UploadPdfDialog";
import { useCreateShopDrawing, useAddShopDrawingRevision } from "./useShopDrawings";
import { shopDrawingsService, type ShopDrawingRow } from "./shopDrawingsService";
import type { AppProject } from "@/types";

function describeShopDrawingError(error: unknown, fallback: string): string {
  const code = (error as { code?: string })?.code;
  if (code === "23505") {
    return "Someone just uploaded a newer revision — refresh and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

// Shared by ProjectFolders.tsx and DrawingFolderExplorer.tsx — both create
// sheets/revisions the same way (author is always the current user's email,
// never user-entered) and need the same error copy. Cache invalidation on
// the mutations themselves (see useShopDrawings.ts) keeps grouped/cached
// data in sync, so callers don't need to pass or call a refetch callback.
export function useShopDrawingActions(project: AppProject) {
  const { user } = useAuth();
  const createShopDrawing = useCreateShopDrawing();
  const addRevision = useAddShopDrawingRevision();

  const handleAddDrawing = (input: NewDrawingInput) => {
    createShopDrawing.mutate(
      {
        project,
        discipline: input.discipline,
        sheetNo: input.no,
        sheetName: input.name,
        author: user?.email ?? null,
        pdfFile: input.pdfFile,
        createdBy: user?.id ?? null,
      },
      {
        onError: (err) => alert(describeShopDrawingError(err, "Failed to add drawing.")),
      }
    );
  };

  const handleUploadRevision = (uploadTarget: ShopDrawingRow, input: UploadRevisionInput) => {
    if (!input.pdfFile) return;
    addRevision.mutate(
      {
        project,
        discipline: uploadTarget.discipline,
        sheetNo: uploadTarget.sheet_no,
        sheetName: uploadTarget.sheet_name,
        author: uploadTarget.author,
        revision: input.revision,
        reason: input.reason,
        pdfFile: input.pdfFile,
        createdBy: user?.id ?? null,
      },
      {
        onError: (err) => alert(describeShopDrawingError(err, "Failed to upload revision.")),
      }
    );
  };

  const handleDownload = (row: ShopDrawingRow) => {
    const url = shopDrawingsService.getPdfPublicUrl(row.pdf_path);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.sheet_no}-${row.sheet_name}-Rev${row.revision}.pdf`;
    a.target = "_blank";
    a.click();
  };

  return { handleAddDrawing, handleUploadRevision, handleDownload, authorEmail: user?.email ?? "" };
}
