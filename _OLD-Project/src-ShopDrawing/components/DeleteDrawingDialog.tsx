import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteDrawingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: {
    id: string;
    no: string;
    name: string;
    current_revision: number;
    project_id?: string | null;
    pdf_url?: string | null;
  } | null;
  onDrawingDeleted: () => void;
}

const DeleteDrawingDialog = ({
  isOpen,
  onClose,
  drawing,
  onDrawingDeleted,
}: DeleteDrawingDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!drawing) return;

    setIsDeleting(true);

    try {
      // Delete PDF from storage if it exists
      if (drawing.pdf_url) {
        // Extract the actual storage path from the pdf_url
        // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
        const urlParts = drawing.pdf_url.split('/storage/v1/object/public/shop-drawing-pdfs/');
        if (urlParts.length === 2) {
          const storagePath = urlParts[1];
          console.log("Attempting to delete PDF from storage:", storagePath);
          
          const { data, error: storageError } = await supabase.storage
            .from("shop-drawing-pdfs")
            .remove([storagePath]);

          if (storageError) {
            console.warn("Failed to delete PDF from storage:", storageError);
            // Continue with database deletion even if storage deletion fails
          } else {
            console.log("PDF deleted from storage, result:", data);
          }
        } else {
          console.warn("Could not parse storage path from pdf_url:", drawing.pdf_url);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("shop_drawings")
        .delete()
        .eq("id", drawing.id);

      if (error) throw error;

      toast({
        title: "Drawing deleted",
        description: `${drawing.no} - ${drawing.name} has been deleted.`,
      });

      onDrawingDeleted();
      onClose();
    } catch (error: any) {
      console.error("Error deleting drawing:", error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete drawing.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Drawing
          </AlertDialogTitle>
          <AlertDialogDescription>
            {drawing ? (
              <>
                Are you sure you want to delete{" "}
                <strong>
                  {drawing.no} - {drawing.name} (Rev {drawing.current_revision})
                </strong>
                ? This action cannot be undone.
              </>
            ) : (
              "Select a drawing to delete."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || !drawing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteDrawingDialog;
