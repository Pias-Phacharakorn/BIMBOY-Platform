import { useState } from "react";
import { Modal } from "@/react-components/components/ui/Modal";
import type { ClashStatus, ClashType } from "@/types";

const NO_CHANGE = "" as const;

interface BulkEditClashModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectionCount: number;
  isSubmitting: boolean;
  onApply: (updates: { status?: ClashStatus; type?: ClashType }) => void;
}

export function BulkEditClashModal({
  isOpen,
  onClose,
  selectionCount,
  isSubmitting,
  onApply,
}: BulkEditClashModalProps) {
  const [status, setStatus] = useState<ClashStatus | typeof NO_CHANGE>(NO_CHANGE);
  const [type, setType] = useState<ClashType | typeof NO_CHANGE>(NO_CHANGE);

  const hasChanges = status !== NO_CHANGE || type !== NO_CHANGE;

  const handleClose = () => {
    setStatus(NO_CHANGE);
    setType(NO_CHANGE);
    onClose();
  };

  const handleApply = () => {
    const updates: { status?: ClashStatus; type?: ClashType } = {};
    if (status !== NO_CHANGE) updates.status = status;
    if (type !== NO_CHANGE) updates.type = type;
    onApply(updates);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-4 text-fg">
        <h3 className="text-sm font-semibold">
          Edit {selectionCount} clash{selectionCount === 1 ? "" : "es"}
        </h3>

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="bulk-edit-status">
            Status
          </label>
          <select
            id="bulk-edit-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ClashStatus | typeof NO_CHANGE)}
            disabled={isSubmitting}
            className="bg-bg text-fg border border-border rounded px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-accent cursor-pointer disabled:opacity-50"
          >
            <option value={NO_CHANGE}>— No change —</option>
            <option value="new">New</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
            <option value="approved_as_note">Approved as Note</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="bulk-edit-type">
            Type
          </label>
          <select
            id="bulk-edit-type"
            value={type}
            onChange={(e) => setType(e.target.value as ClashType | typeof NO_CHANGE)}
            disabled={isSubmitting}
            className="bg-bg text-fg border border-border rounded px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-accent cursor-pointer disabled:opacity-50"
          >
            <option value={NO_CHANGE}>— No change —</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="regulation">Regulation</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center min-h-8 px-3 rounded-radius text-fg text-xs font-semibold hover:bg-[oklch(18%_0.02_255)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isSubmitting || !hasChanges}
            className="inline-flex items-center justify-center min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
