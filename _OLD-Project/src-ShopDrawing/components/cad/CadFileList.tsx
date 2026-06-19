import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { canManageDrawings } from "@/types/roles";
import { useUserRole } from "@/hooks/useUserRole";

interface CadFile {
  id: string;
  name: string;
  file_url: string | null;
  file_type: string;
  created_at: string;
}

interface CadFileListProps {
  projectId: string;
  refreshKey: number;
  onOpenFile: (file: CadFile) => void;
}

const CadFileList = ({ projectId, refreshKey, onOpenFile }: CadFileListProps) => {
  const [files, setFiles] = useState<CadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { role } = useUserRole();

  useEffect(() => {
    if (!projectId) return;
    const fetchFiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('cad_files')
        .select('id, name, file_url, file_type, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && data) setFiles(data);
      setLoading(false);
    };
    fetchFiles();
  }, [projectId, refreshKey]);

  const handleDownload = async (file: CadFile) => {
    if (!file.file_url) return;
    const { data, error } = await supabase.storage.from('cad-files').createSignedUrl(file.file_url, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = file.name;
    a.click();
  };

  const handleDelete = async (file: CadFile) => {
    if (file.file_url) {
      await supabase.storage.from('cad-files').remove([file.file_url]);
    }
    const { error } = await supabase.from('cad_files').delete().eq('id', file.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast({ title: "File deleted" });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground p-2">Loading files...</p>;
  if (files.length === 0) return <p className="text-sm text-muted-foreground p-2">No CAD files uploaded yet.</p>;

  return (
    <div className="space-y-2">
      {files.map(file => (
        <div key={file.id} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-background hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="shrink-0 text-xs uppercase">
              {file.file_type}
            </Badge>
            <span className="text-sm truncate">{file.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenFile(file)} title="Open">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(file)} title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
            {canManageDrawings(role) && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(file)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CadFileList;
