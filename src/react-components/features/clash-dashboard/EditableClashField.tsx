import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { Pencil } from "lucide-react";

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
 * mode, swaps to an input/textarea on click, and saves on blur. Escape
 * reverts the draft without saving (matches the mockup's editable-field rows).
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
    setIsEditing(false);
    if (draft !== value) onSave(draft);
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
        multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
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
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={editClassName || defaultEditClassName}
          />
        )
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

interface EditableSelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onSave: (value: string) => void;
  renderView: (value: string) => ReactNode;
}

/**
 * Same click-to-edit row pattern as EditableTextField, but swaps in a native
 * <select> instead of a text input, and saves immediately on change.
 */
export function EditableSelectField({ label, value, options, disabled = false, onSave, renderView }: EditableSelectFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing) selectRef.current?.focus();
  }, [isEditing]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted text-[10px] font-bold tracking-wider uppercase">{label}</label>
      {isEditing ? (
        <select
          ref={selectRef}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onSave(e.target.value);
            setIsEditing(false);
          }}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
            }
          }}
          className="bg-bg text-fg border border-border rounded px-2 py-1.5 text-sm font-medium focus:outline-none focus:border-accent cursor-pointer w-fit"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
