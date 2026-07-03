import { createPortal } from "react-dom";
import { X, Trash2 } from "lucide-react";
import type { ShopDrawing } from "@/react-components/features/shop-drawings/shopDrawingTypes";

interface DeleteDrawingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: ShopDrawing | null;
  onConfirm: () => void;
}

export function DeleteDrawingDialog({ isOpen, onClose, drawing, onConfirm }: DeleteDrawingDialogProps) {
  if (!isOpen || !drawing) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-[400px] max-w-full flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <span className="flex items-center gap-2 text-xs font-bold text-fg">
            <Trash2 className="w-4 h-4 text-status-danger" />
            Delete Drawing
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer"
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="text-xs text-muted">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-fg">
              {drawing.no} - {drawing.name} (Rev {drawing.currentRevision})
            </span>
            ? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              type="button"
              className="min-h-8 px-3 py-1.5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg text-xs font-semibold hover:border-accent transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              type="button"
              className="min-h-8 px-3 py-1.5 rounded-radius bg-status-danger text-white text-xs font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
