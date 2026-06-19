import { useEffect, useState } from "react";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "F", label: "Focus selected element" },
  { keys: "H", label: "Hide selected element" },
  { keys: "I", label: "Isolate selected element" },
  { keys: "A", label: "Show all (clear hidden)" },
  { keys: "Z", label: "Zoom to fit" },
  { keys: "R", label: "Reset view" },
  { keys: "X", label: "Toggle section plane" },
  { keys: "P", label: "Take screenshot (PNG)" },
  { keys: "Esc", label: "Clear selection" },
  { keys: "?", label: "Show this help" },
];

/**
 * Global keyboard shortcuts for the BIM viewer. Lives inside the viewer
 * page (not the Canvas) and listens on `window`. Ignores events while the
 * user is typing in an input/textarea/contenteditable.
 */
export function BimShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const selectedId = useDigitalTwinStore((s) => s.selectedElementId);
  const requestFocus = useDigitalTwinStore((s) => s.requestFocus);
  const hideElement = useDigitalTwinStore((s) => s.hideElement);
  const isolateElement = useDigitalTwinStore((s) => s.isolateElement);
  const showAllElements = useDigitalTwinStore((s) => s.showAllElements);
  const requestFit = useDigitalTwinStore((s) => s.requestFit);
  const resetView = useDigitalTwinStore((s) => s.resetView);
  const toggleSection = useDigitalTwinStore((s) => s.toggleSection);
  const requestScreenshot = useDigitalTwinStore((s) => s.requestScreenshot);
  const selectElement = useDigitalTwinStore((s) => s.selectElement);

  useEffect(() => {
    function isEditable(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      const k = e.key.toLowerCase();
      const needsSel = () => {
        if (!selectedId) {
          toast.error("Select an element first");
          return false;
        }
        return true;
      };
      switch (k) {
        case "f":
          if (needsSel()) requestFocus(selectedId);
          break;
        case "h":
          if (needsSel()) {
            hideElement(selectedId!);
            toast.success("Element hidden");
          }
          break;
        case "i":
          if (needsSel()) {
            isolateElement(selectedId!);
            requestFocus(selectedId);
            toast.success("Isolated element");
          }
          break;
        case "a":
          showAllElements();
          break;
        case "z":
          requestFit();
          break;
        case "r":
          resetView();
          toast.success("View reset");
          break;
        case "x":
          toggleSection();
          break;
        case "p":
          requestScreenshot();
          toast.success("Screenshot saved");
          break;
        case "escape":
          selectElement(null);
          break;
        case "?":
          setHelpOpen(true);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedId,
    requestFocus,
    hideElement,
    isolateElement,
    showAllElements,
    requestFit,
    resetView,
    toggleSection,
    requestScreenshot,
    selectElement,
  ]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick keys for BIM viewer actions. Disabled while typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border rounded-md border border-border">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="text-foreground">{s.label}</span>
              <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Imperative opener so toolbar buttons can show the help dialog. */
export function useOpenShortcutsHelp() {
  return () => {
    const evt = new KeyboardEvent("keydown", { key: "?" });
    window.dispatchEvent(evt);
  };
}