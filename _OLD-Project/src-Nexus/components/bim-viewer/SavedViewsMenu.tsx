import { useState } from "react";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Saved views dropdown — bookmarks current camera + visibility + section state
 * in localStorage and lets the user jump back to a named view.
 */
export function SavedViewsMenu() {
  const views = useDigitalTwinStore((s) => s.savedViews);
  const saveView = useDigitalTwinStore((s) => s.saveView);
  const applyView = useDigitalTwinStore((s) => s.applyView);
  const deleteView = useDigitalTwinStore((s) => s.deleteView);
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          title={`Saved views${views.length ? ` (${views.length})` : ""}`}
          className="group relative flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
        >
          <Bookmark className="h-4 w-4" />
          {views.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 text-[8px] font-bold text-accent-foreground">
              {views.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Saved views</span>
          <button
            onClick={() => {
              const name = window.prompt("View name?", `View ${views.length + 1}`);
              if (!name) return;
              saveView(name);
              toast.success(`Saved "${name}"`);
            }}
            className="flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> Save current
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 && (
          <p className="px-2 py-3 text-center text-[11px] italic text-muted-foreground">
            No saved views yet.
          </p>
        )}
        {views.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onSelect={(e) => {
              e.preventDefault();
              applyView(v.id);
              toast.success(`Restored "${v.name}"`);
            }}
            className="flex items-center justify-between"
          >
            <span className="truncate">{v.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteView(v.id);
              }}
              className="text-muted-foreground hover:text-destructive"
              title="Delete view"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}