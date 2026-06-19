import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  ClashStatus, ClashPriority, STATUS_OPTIONS, PRIORITY_OPTIONS,
} from "./clashTypes";
import { Trash2, X, Flag, CircleDot, Calendar as CalendarIcon, User, Tag } from "lucide-react";

type Field = "status" | "priority" | "issue_type" | "due_date" | "originator";

interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
  onChanged: () => void;
  canEdit: boolean;
}

const ClashBatchActionsBar = ({ selectedIds, onClear, onChanged, canEdit }: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState<Field | null>(null);
  const [text, setText] = useState("");

  if (selectedIds.size === 0) return null;
  const ids = Array.from(selectedIds);

  const applyUpdate = async (patch: Record<string, any>, label: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("clash_viewpoints").update(patch).in("id", ids);
      if (error) throw error;
      toast({ title: `${label} updated`, description: `${ids.length} issue(s)` });
      onChanged();
      setOpen(null);
      setText("");
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("clash_viewpoints").delete().in("id", ids);
      if (error) throw error;
      toast({ title: "Deleted", description: `${ids.length} issue(s)` });
      onChanged();
      onClear();
      setConfirmDelete(false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const TextPop = ({ field, label, placeholder, type = "text" }: {
    field: Field; label: string; placeholder?: string; type?: string;
  }) => (
    <Popover open={open === field} onOpenChange={(v) => { setOpen(v ? field : null); if (!v) setText(""); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={!canEdit || busy}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-white">
        <Label className="text-xs">{label}</Label>
        <Input
          type={type}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="mt-1"
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => applyUpdate({ [field]: text.trim() ? text.trim() : null }, label)}
            disabled={busy}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-lg border bg-card shadow-sm px-3 py-2">
      <span className="text-sm font-medium">{selectedIds.size} selected</span>
      <span className="text-muted-foreground">·</span>

      <div className="flex items-center gap-1">
        <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          disabled={!canEdit || busy}
          onValueChange={(v) => applyUpdate({ status: v as ClashStatus }, "Status")}
        >
          <SelectTrigger className="h-8 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Flag className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          disabled={!canEdit || busy}
          onValueChange={(v) => applyUpdate({ priority: v as ClashPriority }, "Priority")}
        >
          <SelectTrigger className="h-8 w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>{PRIORITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <TextPop field="issue_type" label="Type" placeholder="e.g. Hard, Clearance" />
      <TextPop field="due_date" label="Due Date" type="date" />
      <TextPop field="originator" label="Assigned To" placeholder="Name" />

      <Button
        size="sm"
        variant="destructive"
        onClick={() => setConfirmDelete(true)}
        disabled={!canEdit || busy}
      >
        <Trash2 className="h-4 w-4 mr-1" /> Delete
      </Button>

      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
        <X className="h-4 w-4 mr-1" /> Clear
      </Button>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} issue(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={del} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClashBatchActionsBar;
