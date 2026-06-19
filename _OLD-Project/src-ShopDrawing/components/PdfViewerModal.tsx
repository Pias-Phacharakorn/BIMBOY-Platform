import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
  onDownload?: () => void;
}

const PdfViewerModal = ({
  isOpen,
  onClose,
  pdfUrl,
  title,
  onDownload,
}: PdfViewerModalProps) => {
  if (!pdfUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium truncate pr-4">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onDownload && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDownload}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Download
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title={`PDF Viewer - ${title}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfViewerModal;
