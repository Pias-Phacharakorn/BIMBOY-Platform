import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface EditableTextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  onSave: (value: string) => void;
  valueClassName?: string;
  editClassName?: string;
}

/**
 * Click-anywhere-on-the-row field: shows static text + a pencil hint in view
 * mode, swaps to an input/textarea on click. Commit only happens via the
 * explicit confirm icon (or Enter on single-line) — clicking away no longer
 * saves. Escape or the cancel icon reverts the draft without saving.
 */
export function EditableTextField({
  label,
  value,
  placeholder,
  multiline = false,
  disabled = false,
  onSave,
  valueClassName = "text-sm text-fg",
  editClassName,
}: EditableTextFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
    }
  };

  const defaultEditClassName =
    "w-full bg-surface border border-border rounded px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted text-[10px] font-bold tracking-wider uppercase">{label}</label>
      {isEditing ? (
        <div className="flex flex-col gap-1.5">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={editClassName || `${defaultEditClassName} text-xs leading-normal resize-none`}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={editClassName || defaultEditClassName}
            />
          )}
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              aria-label="Cancel edit"
              onClick={cancel}
              className="p-1 rounded text-muted hover:text-status-danger hover:bg-surface-raised transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Confirm edit"
              onClick={commit}
              className="p-1 rounded text-muted hover:text-status-ok hover:bg-surface-raised transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setIsEditing(true)}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          className={`group flex items-start justify-between gap-2 ${
            disabled ? "cursor-default opacity-50" : "cursor-pointer"
          }`}
        >
          <p className={`${valueClassName} leading-snug break-words whitespace-pre-wrap flex-1`}>
            {value || <span className="text-muted italic">{placeholder || "—"}</span>}
          </p>
          {!disabled && (
            <Pencil className="w-3 h-3 text-muted/40 group-hover:text-muted shrink-0 mt-1 transition-colors" />
          )}
        </div>
      )}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
  /** Solid bg- class rendered as a colored bar next to this option in the open list (e.g. statusAccentClassMap). */
  accentClassName?: string;
}

interface EditableSelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onSave: (value: string) => void;
  renderView: (value: string) => ReactNode;
}

/**
 * Same click-to-edit row pattern as EditableTextField, but swaps in a
 * hand-rolled listbox (native <select> can't style per-option colored bars/
 * checkmarks) and saves immediately on option click — no confirm/cancel step,
 * since picking an option is itself the commit.
 */
export function EditableSelectField({ label, value, options, disabled = false, onSave, renderView }: EditableSelectFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) setIsOpen(true);
  }, [isEditing]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const closeEditing = () => {
    setIsOpen(false);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted text-[10px] font-bold tracking-wider uppercase">{label}</label>
      {isEditing ? (
        <div
          ref={containerRef}
          className="relative w-fit"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeEditing();
            }
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 border border-border-strong rounded-radius bg-bg text-sm font-medium focus:outline-none focus:border-accent cursor-pointer"
          >
            {renderView(value)}
            {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
          </button>

          {isOpen && (
            <ul
              role="listbox"
              className="absolute left-0 z-20 mt-1 min-w-full w-max border border-border rounded-radius bg-surface-raised shadow-lg py-1 overflow-hidden"
            >
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <li key={opt.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onSave(opt.value);
                        closeEditing();
                      }}
                      className={`w-full flex items-center gap-2 pl-2.5 pr-3 py-1.5 text-sm text-left cursor-pointer border-0 transition-colors ${
                        selected ? "bg-accent-muted/40 text-fg font-medium" : "bg-transparent text-fg hover:bg-surface-alt"
                      }`}
                    >
                      <span className={`inline-block w-1 h-4 rounded-full shrink-0 ${opt.accentClassName || "bg-border-strong"}`} />
                      <span className="flex-1 whitespace-nowrap">{opt.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setIsEditing(true)}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          className={`group flex items-center justify-between gap-2 w-fit ${
            disabled ? "cursor-default opacity-50" : "cursor-pointer"
          }`}
        >
          {renderView(value)}
          {!disabled && <Pencil className="w-3 h-3 text-muted/40 group-hover:text-muted shrink-0 transition-colors" />}
        </div>
      )}
    </div>
  );
}
