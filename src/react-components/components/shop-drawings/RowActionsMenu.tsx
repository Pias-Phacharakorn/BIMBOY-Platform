import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RowAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
}

export function RowActionsMenu({ actions }: RowActionsMenuProps) {
  // menuPos doubles as the open flag — it's non-null exactly when the menu
  // should be showing, so a separate isOpen boolean would just be a second
  // thing to keep in sync with it at every open/close call site.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  const isOpen = menuPos !== null;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The menu is portaled to document.body, so it's not a DOM descendant
      // of rootRef — check both, or every click inside the menu would look
      // "outside" and close it before its own onClick can fire.
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuPos(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuPos(null);
    };
    // Scroll events don't bubble, but a capture-phase listener on window still
    // fires for scrolls on any descendant scrollable container — close the
    // menu rather than let it drift out of sync with its trigger's position.
    const handleScroll = () => setMenuPos(null);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setMenuPos(null) : openMenu())}
        className="p-1.5 rounded-radius hover:bg-surface-raised text-muted hover:text-fg transition-colors duration-120 cursor-pointer"
        title="Actions"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[9999] w-48 py-1 bg-surface-raised border border-border rounded-radius shadow-xl flex flex-col"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  title={action.title}
                  onClick={() => {
                    setMenuPos(null);
                    action.onClick();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors duration-120",
                    action.disabled
                      ? "text-muted/40 cursor-not-allowed"
                      : action.danger
                        ? "text-status-danger hover:bg-status-danger/10 cursor-pointer"
                        : "text-fg hover:bg-surface-alt cursor-pointer"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
