import { useState, useRef, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import type { AppIconName } from "@/react-components/components/ui";
import { cn } from "@/lib/utils";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

type ActionKey = "showAll" | "isolate" | "hide";

const menuItemClass =
  "inline-flex items-center justify-center min-h-8 w-8 p-1 border border-transparent rounded-radius bg-transparent cursor-pointer text-white hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent";

/**
 * Icon-only menu row. `group` sits on the wrapper, not the button: a native
 * `<button disabled>` doesn't reliably match `:hover`, and the disabled rows
 * are exactly the ones whose pill needs to explain why they're disabled.
 */
function MenuRow({
  icon,
  label,
  hint,
  busy,
  disabled,
  onClick,
}: {
  icon: AppIconName;
  label: string;
  hint?: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="group relative flex items-center">
      <button
        className={menuItemClass}
        type="button"
        disabled={disabled}
        onClick={onClick}
      >
        <Icon
          name={icon}
          size={18}
          className={cn("shrink-0", busy && "animate-spin")}
        />
      </button>

      <span className="pointer-events-none absolute left-full ml-2 z-10 whitespace-nowrap rounded-md bg-surface border border-border shadow-lg px-2 py-1 text-[11px] font-semibold text-fg opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        {hint ? `${label} — ${hint}` : label}
      </span>
    </div>
  );
}

export function ToolbarVisibility() {
  const { components, selectedElementIds } = useBimStore();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!components) return null;

  const hasSelection = selectedElementIds.length > 0;

  // Every row runs through here: spin the clicked row, lock the menu, close when
  // the Hider call resolves. The dropdown stays open for the duration so a slow
  // isolate on a big model still reads as "working", not as a dropped click.
  const runAction = async (key: ActionKey, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      console.error(`[ToolbarVisibility] ${key} failed:`, err);
    } finally {
      setBusy(null);
      setIsOpen(false);
    }
  };

  const handleShowAll = () =>
    runAction("showAll", async () => {
      const hider = components.get(OBC.Hider);
      await hider.set(true);
    });

  // Actions read the live selection off the Highlighter rather than the store's
  // `selectionMap` clone, which trails it by an event. The store is only trusted
  // for the enabled/disabled state above. Same reasoning as ToolbarFocus.
  const handleIsolate = () =>
    runAction("isolate", async () => {
      const highlighter = components.get(OBF.Highlighter);
      const selection = highlighter.selection.select;
      if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
      const hider = components.get(OBC.Hider);
      await hider.isolate(selection);
    });

  // Hide clears the selection afterwards; Isolate deliberately does not. Once
  // hidden, the selection points at geometry the user can no longer see —
  // whereas isolated items stay on screen and remain chainable into Focus.
  const handleHide = () =>
    runAction("hide", async () => {
      const highlighter = components.get(OBF.Highlighter);
      const selection = highlighter.selection.select;
      if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
      const hider = components.get(OBC.Hider);
      await Promise.all([hider.set(false, selection), highlighter.clear("select")]);
    });

  const buttonClass = cn(
    "inline-flex items-center justify-center gap-2 min-h-8 p-1 border rounded-radius bg-transparent cursor-pointer text-xs font-semibold transition-all duration-120 text-white",
    isOpen
      ? "border-border bg-surface-alt text-fg"
      : "border-transparent hover:border-border hover:bg-surface-alt hover:text-fg"
  );

  // Reads as "Isolate — select items first" in the hover pill.
  const selectionHint = hasSelection ? undefined : "select items first";

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
        title="Visibility"
        type="button"
      >
        <Icon name="SHOW" size={20} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col gap-1 p-1 rounded-[14px] bg-surface border border-border shadow-xl z-50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150">
          <MenuRow
            icon="SHOW"
            label="Show All"
            busy={busy === "showAll"}
            disabled={busy !== null}
            onClick={handleShowAll}
          />
          <MenuRow
            icon="ISOLATE"
            label="Isolate"
            hint={selectionHint}
            busy={busy === "isolate"}
            disabled={busy !== null || !hasSelection}
            onClick={handleIsolate}
          />
          <MenuRow
            icon="HIDE"
            label="Hide"
            hint={selectionHint}
            busy={busy === "hide"}
            disabled={busy !== null || !hasSelection}
            onClick={handleHide}
          />
        </div>
      )}
    </div>
  );
}
