import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, FileUp } from "lucide-react";
import type { ShopDrawing } from "@/react-components/features/shop-drawings/shopDrawingTypes";

export interface UploadRevisionInput {
  revision: number;
  reason: string;
  pdfFile: File | null;
}

interface UploadPdfDialogProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: ShopDrawing | null;
  onUpload: (input: UploadRevisionInput) => void;
}

export function UploadPdfDialog({ isOpen, onClose, drawing, onUpload }: UploadPdfDialogProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !drawing) return null;

  const nextRevision = drawing.currentRevision + 1;

  const resetAndClose = () => {
    setPdfFile(null);
    setReason("");
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setFormError("Please select a PDF file.");
      return;
    }
    setFormError(null);
    setPdfFile(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setFormError("A reason is required to upload a new revision.");
      return;
    }
    if (!pdfFile) {
      setFormError("Select a PDF to upload as the new revision.");
      return;
    }
    onUpload({ revision: nextRevision, reason: trimmedReason, pdfFile });
    resetAndClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={resetAndClose}
    >
      <div
        className="w-[420px] max-w-full flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <span className="flex items-center gap-2 text-xs font-bold text-fg">
            <Upload className="w-4 h-4" />
            Upload New Revision
          </span>
          <button
            onClick={resetAndClose}
            className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer"
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          <p className="text-xs text-muted">
            {drawing.no} — {drawing.name}
            <br />
            Current revision <span className="font-semibold text-fg">Rev {drawing.currentRevision}</span> → new
            revision <span className="font-semibold text-fg">Rev {nextRevision}</span>
          </p>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Reason *
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="px-3 py-2 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              placeholder="e.g., Updated grid line per structural comment"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            PDF File *
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3 flex items-center gap-2 text-xs bg-surface-alt border border-border rounded-radius text-muted hover:text-fg hover:border-accent transition-colors"
            >
              <FileUp className="w-3.5 h-3.5" />
              {pdfFile ? <span className="truncate text-fg">{pdfFile.name}</span> : <span>Click to select PDF...</span>}
            </button>
          </label>

          {formError && <p className="text-[11px] text-status-danger">{formError}</p>}

          <button
            type="submit"
            className="mt-1 w-full min-h-9 py-2 px-4 rounded-radius bg-accent hover:opacity-90 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Revision
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
