import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string | null;
}

export function PdfViewerModal({ isOpen, onClose, title, pdfUrl }: PdfViewerModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-surface" onClick={onClose}>
      <div className="flex flex-col flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <span className="flex items-center gap-2 text-xs font-bold text-fg truncate">
            <FileText className="w-4 h-4 flex-none" />
            <span className="truncate">{title}</span>
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer flex-none"
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0" title={title} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-6 h-full">
              <FileText className="w-10 h-10 text-muted" />
              <p className="text-sm text-fg font-semibold">No PDF available for this revision.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
