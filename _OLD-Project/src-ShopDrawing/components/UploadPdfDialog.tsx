import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, CheckCircle2, FileUp } from "lucide-react";

interface UploadPdfDialogProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: {
    id: string;
    no: string;
    name: string;
    current_revision: number;
    project_id: string | null;
    sheet_id: string | null;
    author: string | null;
  } | null;
  onPdfUploaded: () => void;
}

type UploadStage = "idle" | "uploading" | "updating" | "complete";

const UploadPdfDialog = ({
  isOpen,
  onClose,
  drawing,
  onPdfUploaded,
}: UploadPdfDialogProps) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [createNewRevision, setCreateNewRevision] = useState(false);
  const [newRevision, setNewRevision] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Set default new revision when dialog opens or toggle changes
  useEffect(() => {
    if (drawing && createNewRevision) {
      setNewRevision(String(drawing.current_revision + 1));
    }
  }, [drawing, createNewRevision]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "PDF must be under 50MB.",
          variant: "destructive",
        });
        return;
      }
      setPdfFile(file);
    }
  }, [toast]);

  const handleUpload = async () => {
    if (!pdfFile || !drawing) return;

    setUploadStage("uploading");
    setProgress(10);

    try {
      const revisionNum = createNewRevision ? parseInt(newRevision, 10) : drawing.current_revision;
      const fileExt = "pdf";
      const fileName = `${drawing.project_id || "general"}/${drawing.no}_Rev${revisionNum}_${Date.now()}.${fileExt}`;

      setProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("shop-drawing-pdfs")
        .upload(fileName, pdfFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(uploadError.message || "Failed to upload PDF to storage");
      }

      setProgress(70);
      setUploadStage("updating");

      // Use a long-lived signed URL — never persist getPublicUrl() output for a private bucket
      const { data: urlData, error: signError } = await supabase.storage
        .from("shop-drawing-pdfs")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      if (signError || !urlData?.signedUrl) {
        throw new Error(signError?.message || "Failed to generate signed URL");
      }

      setProgress(85);

      if (createNewRevision) {
        // Mark existing records as not latest
        await supabase
          .from("shop_drawings")
          .update({ is_latest: false })
          .eq("sheet_id", drawing.sheet_id || drawing.no)
          .eq("project_id", drawing.project_id);

        // Create new revision record
        const { error: insertError } = await supabase
          .from("shop_drawings")
          .insert({
            no: drawing.no,
            name: drawing.name,
            current_revision: revisionNum,
            project_id: drawing.project_id,
            sheet_id: drawing.sheet_id,
            author: drawing.author,
            pdf_url: urlData.signedUrl,
            is_latest: true,
          });

        if (insertError) throw insertError;
      } else {
        // Just update the existing record with PDF
        const { error: updateError } = await supabase
          .from("shop_drawings")
          .update({ pdf_url: urlData.signedUrl })
          .eq("id", drawing.id);

        if (updateError) throw updateError;
      }

      setProgress(100);
      setUploadStage("complete");

      toast({
        title: createNewRevision ? "New revision created" : "PDF uploaded",
        description: createNewRevision 
          ? `Rev ${revisionNum} created for ${drawing.no}.`
          : `PDF attached to ${drawing.no}.`,
      });

      // Brief delay to show completion state
      setTimeout(() => {
        resetForm();
        onPdfUploaded();
        onClose();
      }, 500);
    } catch (error: any) {
      console.error("Error uploading PDF:", error);
      setUploadStage("idle");
      setProgress(0);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload PDF.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setPdfFile(null);
    setUploadStage("idle");
    setProgress(0);
    setCreateNewRevision(false);
    setNewRevision("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (uploadStage === "idle" || uploadStage === "complete") {
      resetForm();
      onClose();
    }
  };

  const isUploading = uploadStage === "uploading" || uploadStage === "updating";

  const getStatusText = () => {
    switch (uploadStage) {
      case "uploading":
        return "Uploading file...";
      case "updating":
        return createNewRevision ? "Creating new revision..." : "Updating record...";
      case "complete":
        return "Complete!";
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload PDF
          </DialogTitle>
          <DialogDescription>
            {drawing
              ? `Attach a PDF to ${drawing.no} - ${drawing.name} (Rev ${drawing.current_revision})`
              : "Select a drawing first"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pdfFile">PDF File</Label>
            <input
              ref={fileInputRef}
              id="pdfFile"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full justify-start text-left font-normal"
            >
              <FileUp className="mr-2 h-4 w-4 text-muted-foreground" />
              {pdfFile ? (
                <span className="truncate">{pdfFile.name}</span>
              ) : (
                <span className="text-muted-foreground">Click to select PDF...</span>
              )}
            </Button>
            {pdfFile && (
              <p className="text-sm text-muted-foreground">
                Size: {(pdfFile.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="createNewRevision" className="text-sm font-medium">
                Create new revision
              </Label>
              <p className="text-xs text-muted-foreground">
                Add as a new version instead of replacing current PDF
              </p>
            </div>
            <Switch
              id="createNewRevision"
              checked={createNewRevision}
              onCheckedChange={setCreateNewRevision}
              disabled={isUploading}
            />
          </div>

          {createNewRevision && (
            <div className="space-y-2">
              <Label htmlFor="newRevision">New Revision Number</Label>
              <Input
                id="newRevision"
                type="number"
                min={drawing ? drawing.current_revision + 1 : 1}
                max={999}
                value={newRevision}
                onChange={(e) => setNewRevision(e.target.value)}
                disabled={isUploading}
              />
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{getStatusText()}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {uploadStage === "complete" && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>Upload complete!</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!pdfFile || isUploading}
            className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/90"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {createNewRevision ? "Creating..." : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {createNewRevision ? "Create Revision" : "Upload PDF"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadPdfDialog;