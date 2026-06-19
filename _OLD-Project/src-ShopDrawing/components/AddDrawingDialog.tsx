import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Loader2, CheckCircle2, FileUp } from "lucide-react";

interface AddDrawingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onDrawingAdded: () => void;
}

type SubmitStage = "idle" | "uploading" | "saving" | "complete";

const AddDrawingDialog = ({
  isOpen,
  onClose,
  projectId,
  onDrawingAdded,
}: AddDrawingDialogProps) => {
  const [sheetNumber, setSheetNumber] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [author, setAuthor] = useState("");
  const [revision, setRevision] = useState("0");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-populate author with current user's name
  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", session.user.id)
          .maybeSingle();
        
        if (profile) {
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
          setAuthor(fullName || session.user.email?.split("@")[0] || "");
        } else {
          setAuthor(session.user.email?.split("@")[0] || "");
        }
      }
    };
    
    if (isOpen) {
      fetchUserName();
    }
  }, [isOpen]);

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

  const resetForm = useCallback(() => {
    setSheetNumber("");
    setSheetName("");
    setAuthor("");
    setRevision("0");
    setPdfFile(null);
    setSubmitStage("idle");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sheetNumber.trim() || !sheetName.trim()) {
      toast({
        title: "Missing fields",
        description: "Sheet number and name are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitStage(pdfFile ? "uploading" : "saving");
    setProgress(pdfFile ? 10 : 50);

    try {
      let pdfUrl: string | null = null;

      // Upload PDF if provided
      if (pdfFile) {
        const fileExt = "pdf";
        const fileName = `${projectId}/${sheetNumber.trim()}_Rev${revision}_${Date.now()}.${fileExt}`;

        setProgress(30);
        
        const { error: uploadError } = await supabase.storage
          .from("shop-drawings")
          .upload(fileName, pdfFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(uploadError.message || "Failed to upload PDF to storage");
        }

        setProgress(70);

        // Use a long-lived signed URL — never persist getPublicUrl() output for a private bucket
        const { data: urlData, error: signError } = await supabase.storage
          .from("shop-drawings")
          .createSignedUrl(fileName, 60 * 60 * 24 * 365);

        if (signError || !urlData?.signedUrl) {
          throw new Error(signError?.message || "Failed to generate signed URL");
        }

        pdfUrl = urlData.signedUrl;
      }

      setSubmitStage("saving");
      setProgress(75);

      // Insert the drawing record
      const { error: insertError } = await supabase.from("shop_drawings").insert({
        project_id: projectId,
        no: sheetNumber.trim(),
        name: sheetName.trim(),
        author: author.trim() || null,
        current_revision: parseInt(revision, 10),
        is_latest: true,
        pdf_url: pdfUrl,
      });

      if (insertError) throw insertError;

      setProgress(100);
      setSubmitStage("complete");

      toast({
        title: "Drawing added",
        description: `${sheetNumber} - ${sheetName} has been added.`,
      });

      // Brief delay to show completion state
      setTimeout(() => {
        resetForm();
        onDrawingAdded();
        onClose();
      }, 500);
    } catch (error: any) {
      console.error("Error adding drawing:", error);
      setSubmitStage("idle");
      setProgress(0);
      toast({
        title: "Error",
        description: error.message || "Failed to add drawing.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (submitStage === "idle" || submitStage === "complete") {
      resetForm();
      onClose();
    }
  };

  const isSubmitting = submitStage === "uploading" || submitStage === "saving";

  const getStatusText = () => {
    switch (submitStage) {
      case "uploading":
        return "Uploading PDF...";
      case "saving":
        return "Saving drawing...";
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
            <Plus className="h-5 w-5" />
            Add New Drawing
          </DialogTitle>
          <DialogDescription>
            Manually add a new shop drawing to this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheetNumber">Sheet Number *</Label>
            <Input
              id="sheetNumber"
              placeholder="e.g., A-101"
              value={sheetNumber}
              onChange={(e) => setSheetNumber(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheetName">Sheet Name *</Label>
            <Input
              id="sheetName"
              placeholder="e.g., Floor Plan - Level 1"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              placeholder="e.g., John Doe"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="revision">Revision</Label>
            <Input
              id="revision"
              type="number"
              min="0"
              max="999"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdfUpload">PDF File (optional)</Label>
            <input
              ref={fileInputRef}
              id="pdfUpload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
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

          {isSubmitting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{getStatusText()}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {submitStage === "complete" && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>Drawing added successfully!</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {submitStage === "uploading" ? "Uploading..." : "Saving..."}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Drawing
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddDrawingDialog;
