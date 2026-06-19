import { useCallback, useState } from "react";
import { Upload, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface CadFileUploadProps {
  projectId: string;
  onUploadComplete: () => void;
}

const CadFileUpload = ({ projectId, onUploadComplete }: CadFileUploadProps) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ext === 'dwg' || ext === 'dxf';
    });

    if (validFiles.length === 0) {
      toast({ title: "Invalid file type", description: "Please upload .dwg or .dxf files.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsUploading(false); return; }

    for (const file of validFiles) {
      const ext = file.name.toLowerCase().split('.').pop() || 'dwg';
      const filePath = `${projectId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('cad-files')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from('cad-files').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('cad_files').insert({
        project_id: projectId,
        name: file.name,
        file_url: filePath,
        file_type: ext,
        uploaded_by: user.id,
      });

      if (dbError) {
        toast({ title: "Error saving file record", description: dbError.message, variant: "destructive" });
      }
    }

    toast({ title: "Upload complete", description: `${validFiles.length} file(s) uploaded.` });
    setIsUploading(false);
    onUploadComplete();
  }, [projectId, toast, onUploadComplete]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  }, [handleFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
    >
      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        Drag & drop .dwg or .dxf files here
      </p>
      <label>
        <Button variant="outline" size="sm" disabled={isUploading} asChild>
          <span>
            <FileUp className="h-4 w-4 mr-1" />
            {isUploading ? "Uploading..." : "Browse Files"}
          </span>
        </Button>
        <input
          type="file"
          accept=".dwg,.dxf"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
      </label>
    </div>
  );
};

export default CadFileUpload;
