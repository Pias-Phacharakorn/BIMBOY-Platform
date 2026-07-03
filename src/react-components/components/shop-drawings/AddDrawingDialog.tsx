import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, FileUp } from "lucide-react";

export interface NewDrawingInput {
  no: string;
  name: string;
  author: string;
  pdfFile: File;
}

interface AddDrawingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (drawing: NewDrawingInput) => void;
}

export function AddDrawingDialog({ isOpen, onClose, onAdd }: AddDrawingDialogProps) {
  const [no, setNo] = useState("");
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setNo("");
    setName("");
    setAuthor("");
    setPdfFile(null);
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

    const trimmedNo = no.trim();
    const trimmedName = name.trim();
    if (!trimmedNo || !trimmedName) {
      setFormError("Sheet number and name are required.");
      return;
    }
    if (trimmedNo.includes("/")) {
      setFormError("Sheet number cannot contain \"/\".");
      return;
    }
    if (!pdfFile) {
      setFormError("A PDF file is required to create a drawing.");
      return;
    }

    onAdd({
      no: trimmedNo,
      name: trimmedName,
      author: author.trim(),
      pdfFile,
    });
    resetAndClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={resetAndClose}
    >
      <div
        className="w-[440px] max-w-full max-h-[85vh] flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <span className="flex items-center gap-2 text-xs font-bold text-fg">
            <Plus className="w-4 h-4" />
            Add New Drawing
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 overflow-y-auto">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Sheet Number *
            <input
              type="text"
              value={no}
              onChange={(e) => setNo(e.target.value)}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g., A-101"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Sheet Name *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g., Floor Plan - Level 1"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Author
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g., John Doe"
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
            <Plus className="w-3.5 h-3.5" />
            Add Drawing
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
