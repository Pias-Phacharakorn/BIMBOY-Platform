import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TASK_TYPES, PRIORITY_OPTIONS } from "@/lib/recurrenceUtils";

interface Project {
  id: string;
  name: string;
}

interface WorkloadEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSaved: () => void;
  editEntry?: any | null;
}

const WorkloadEntryForm = ({ open, onOpenChange, userId, onSaved, editEntry }: WorkloadEntryFormProps) => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [taskType, setTaskType] = useState("other");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [workloadPercent, setWorkloadPercent] = useState("");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (open) {
      fetchProjects();
      if (editEntry) {
        setTitle(editEntry.title);
        setProjectId(editEntry.project_id || "");
        setTaskType(editEntry.task_type);
        setDescription(editEntry.description || "");
        const sd = new Date(editEntry.start_datetime);
        const ed = new Date(editEntry.end_datetime);
        setStartDate(sd.toISOString().slice(0, 10));
        setEndDate(ed.toISOString().slice(0, 10));
        setStartTime(sd.toTimeString().slice(0, 5));
        setEndTime(ed.toTimeString().slice(0, 5));
        setEstimatedHours(editEntry.estimated_hours?.toString() || "");
        setWorkloadPercent(editEntry.workload_percent?.toString() || "");
        setPriority(editEntry.priority);
      } else {
        resetForm();
      }
    }
  }, [open, editEntry]);

  const resetForm = () => {
    setTitle("");
    setProjectId("");
    setTaskType("other");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    setEstimatedHours("");
    setWorkloadPercent("");
    setPriority("medium");
  };

  const fetchProjects = async () => {
    const { data: memberData } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    if (memberData && memberData.length > 0) {
      const projectIds = memberData.map(m => m.project_id);
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (projectsData) setProjects(projectsData);
    }
  };

  const autoCalculateHours = () => {
    if (startDate && endDate && startTime && endTime) {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        return (diffMs / 3600000).toFixed(1);
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!title || !startDate || !endDate || !startTime || !endTime) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const startDt = `${startDate}T${startTime}:00`;
    const endDt = `${endDate}T${endTime}:00`;

    if (new Date(endDt) <= new Date(startDt)) {
      toast({ title: "Invalid dates", description: "End must be after start.", variant: "destructive" });
      return;
    }

    const hours = estimatedHours ? parseFloat(estimatedHours) : parseFloat(autoCalculateHours() || "0");

    setSaving(true);
    const entry = {
      user_id: userId,
      project_id: projectId || null,
      title,
      task_type: taskType,
      description: description || null,
      start_datetime: startDt,
      end_datetime: endDt,
      estimated_hours: hours || null,
      workload_percent: workloadPercent ? parseFloat(workloadPercent) : null,
      priority,
      is_recurring: false,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase.from("workload_entries").update(entry).eq("id", editEntry.id));
    } else {
      ({ error } = await supabase.from("workload_entries").insert(entry));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editEntry ? "Updated" : "Created", description: "Workload entry saved." });
      onOpenChange(false);
      onSaved();
    }
  };

  const calculatedHours = autoCalculateHours();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editEntry ? "Edit Workload Entry" : "New Workload Entry"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project</Label>
              <Select value={projectId || "none"} onValueChange={v => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time * (HH:mm)</Label>
              <Input
                type="text"
                value={startTime}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9:]/g, "");
                  if (v.length <= 5) setStartTime(v);
                }}
                onBlur={() => {
                  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
                  if (match) {
                    const h = match[1].padStart(2, "0");
                    const m = match[2];
                    if (parseInt(h) < 24 && parseInt(m) < 60) {
                      setStartTime(`${h}:${m}`);
                    }
                  }
                }}
                placeholder="09:00"
                maxLength={5}
              />
            </div>
            <div>
              <Label>End Time * (HH:mm)</Label>
              <Input
                type="text"
                value={endTime}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9:]/g, "");
                  if (v.length <= 5) setEndTime(v);
                }}
                onBlur={() => {
                  const match = endTime.match(/^(\d{1,2}):(\d{2})$/);
                  if (match) {
                    const h = match[1].padStart(2, "0");
                    const m = match[2];
                    if (parseInt(h) < 24 && parseInt(m) < 60) {
                      setEndTime(`${h}:${m}`);
                    }
                  }
                }}
                placeholder="10:00"
                maxLength={5}
              />
            </div>
          </div>
          {calculatedHours && !estimatedHours && (
            <p className="text-xs text-muted-foreground">Auto-calculated: {calculatedHours}h</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Est. Hours</Label>
              <Input type="number" step="0.5" min="0" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} placeholder="Auto" />
            </div>
            <div>
              <Label>Workload %</Label>
              <Input type="number" min="0" max="100" value={workloadPercent} onChange={e => setWorkloadPercent(e.target.value)} placeholder="0-100" />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
            {saving ? "Saving..." : editEntry ? "Update Entry" : "Create Entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkloadEntryForm;
