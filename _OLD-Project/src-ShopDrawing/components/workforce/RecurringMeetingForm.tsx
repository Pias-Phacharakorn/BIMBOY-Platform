import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateHumanReadable, TASK_TYPES, type RecurringRule } from "@/lib/recurrenceUtils";

interface Project { id: string; name: string; }

export interface EditRecurringData {
  rule: RecurringRule;
  template: {
    id: string;
    title: string;
    project_id: string | null;
    description: string | null;
    workload_percent: number | null;
    task_type: string | null;
  } | null;
}

export type RecurringCategory = "meeting" | "corporate_work";

interface RecurringMeetingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSaved: () => void;
  editData?: EditRecurringData | null;
  category?: RecurringCategory;
}

const DAYS = [
  { code: "MO", label: "Mon" },
  { code: "TU", label: "Tue" },
  { code: "WE", label: "Wed" },
  { code: "TH", label: "Thu" },
  { code: "FR", label: "Fri" },
  { code: "SA", label: "Sat" },
  { code: "SU", label: "Sun" },
];

const RecurringMeetingForm = ({ open, onOpenChange, userId, onSaved, editData, category = "meeting" }: RecurringMeetingFormProps) => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [intervalVal, setIntervalVal] = useState(1);
  const [byDay, setByDay] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noEndDate, setNoEndDate] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [workloadPercent, setWorkloadPercent] = useState("");
  const [taskType, setTaskType] = useState("");

  const isEditing = !!editData;

  useEffect(() => {
    if (open) {
      fetchProjects();
      if (editData) {
        const { rule, template } = editData;
        setTitle(template?.title || rule.human_readable || "");
        setProjectId(template?.project_id || "");
        setDescription(template?.description || "");
        setFrequency(rule.frequency);
        setIntervalVal(rule.interval_val);
        setByDay(rule.by_day || []);
        setStartDate(rule.start_date);
        setEndDate(rule.end_date || "");
        setNoEndDate(!rule.end_date);
        setStartTime(rule.start_time.substring(0, 5));
        setEndTime(rule.end_time.substring(0, 5));
        setWorkloadPercent(template?.workload_percent?.toString() || "");
        setTaskType(template?.task_type || category);
      } else {
        setTitle("");
        setProjectId("");
        setDescription("");
        setFrequency("weekly");
        setIntervalVal(1);
        setByDay([]);
        setStartDate("");
        setEndDate("");
        setNoEndDate(true);
        setStartTime("09:00");
        setEndTime("10:00");
        setWorkloadPercent("");
        setTaskType(category);
      }
    }
  }, [open, editData]);

  const fetchProjects = async () => {
    const { data: memberData } = await supabase
      .from("project_members").select("project_id").eq("user_id", userId);
    if (memberData && memberData.length > 0) {
      const ids = memberData.map(m => m.project_id);
      const { data } = await supabase.from("projects").select("id, name").in("id", ids);
      if (data) setProjects(data);
    }
  };

  const toggleDay = (code: string) => {
    setByDay(prev => prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code]);
  };

  const humanReadable = useMemo(() => {
    return generateHumanReadable(frequency, intervalVal, byDay.length > 0 ? byDay : null, startTime, endTime);
  }, [frequency, intervalVal, byDay, startTime, endTime]);

  const handleSave = async () => {
    if (!title || !startDate || !startTime || !endTime) {
      toast({ title: "Missing fields", description: "Please fill required fields.", variant: "destructive" });
      return;
    }
    if (endTime <= startTime) {
      toast({ title: "Invalid time", description: "End time must be after start time.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const ruleData = {
      user_id: userId,
      frequency,
      interval_val: frequency === "biweekly" ? 2 : intervalVal,
      by_day: byDay.length > 0 ? byDay : null,
      start_date: startDate,
      end_date: noEndDate ? null : (endDate || null),
      start_time: startTime + ":00",
      end_time: endTime + ":00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      human_readable: humanReadable,
    };

    if (isEditing) {
      // Update existing rule
      const { error: ruleError } = await supabase
        .from("recurring_rules")
        .update(ruleData)
        .eq("id", editData.rule.id);

      if (ruleError) {
        setSaving(false);
        toast({ title: "Error", description: ruleError.message, variant: "destructive" });
        return;
      }

      // Update template workload entry
      if (editData.template) {
        const entryUpdate = {
          title,
          project_id: projectId || null,
          description: description || null,
          start_datetime: `${startDate}T${startTime}:00+00:00`,
          end_datetime: `${startDate}T${endTime}:00+00:00`,
          workload_percent: workloadPercent ? parseFloat(workloadPercent) : null,
          task_type: taskType || category,
        };
        const { error: entryError } = await supabase
          .from("workload_entries")
          .update(entryUpdate)
          .eq("id", editData.template.id);

        if (entryError) {
          toast({ title: "Warning", description: "Rule updated but template entry failed: " + entryError.message, variant: "destructive" });
        }
      }

      setSaving(false);
      toast({ title: "Updated", description: "Recurring meeting updated." });
    } else {
      // Create new rule
      const { data: rule, error } = await supabase
        .from("recurring_rules")
        .insert(ruleData)
        .select()
        .single();

      if (error || !rule) {
        setSaving(false);
        toast({ title: "Error", description: error?.message || "Failed to create rule.", variant: "destructive" });
        return;
      }

      const entryData = {
        user_id: userId,
        project_id: projectId || null,
        title,
        task_type: taskType || category,
        description: description || null,
        start_datetime: `${startDate}T${startTime}:00+00:00`,
        end_datetime: `${startDate}T${endTime}:00+00:00`,
        estimated_hours: null,
        workload_percent: workloadPercent ? parseFloat(workloadPercent) : null,
        is_recurring: true,
        recurring_rule_id: rule.id,
        priority: "medium",
      };

      const { error: entryError } = await supabase.from("workload_entries").insert(entryData);

      setSaving(false);
      if (entryError) {
        toast({ title: "Warning", description: "Rule created but template entry failed: " + entryError.message, variant: "destructive" });
      } else {
        toast({ title: "Created", description: "Recurring meeting scheduled." });
      }
    }

    onOpenChange(false);
    onSaved();
  };

  const showDayPicker = frequency === "weekly" || frequency === "biweekly";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? (category === "corporate_work" ? "Edit Corporate Work" : "Edit Recurring Meeting") : (category === "corporate_work" ? "Schedule Corporate Work" : "Schedule Recurring Meeting")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>{category === "corporate_work" ? "Work Title *" : "Meeting Title *"}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={category === "corporate_work" ? "Weekly report preparation" : "Weekly standup"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project</Label>
              <Select value={projectId || "none"} onValueChange={v => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
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
                  {category === "corporate_work" && <SelectItem value="corporate_work">Corporate Work</SelectItem>}
                  {category === "meeting" && <SelectItem value="meeting">Meeting</SelectItem>}
                  {TASK_TYPES.filter(t => t.value !== "meeting").map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showDayPicker && (
            <div>
              <Label className="mb-2 block">Days of Week</Label>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map(d => (
                  <Button
                    key={d.code}
                    type="button"
                    size="sm"
                    variant={byDay.includes(d.code) ? "default" : "outline"}
                    onClick={() => toggleDay(d.code)}
                    className="h-8 w-10 text-xs"
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={noEndDate} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={noEndDate} onCheckedChange={setNoEndDate} />
            <Label className="text-sm">No end date</Label>
          </div>

          <div>
            <Label>Workload %</Label>
            <Input type="number" min="0" max="100" value={workloadPercent} onChange={e => setWorkloadPercent(e.target.value)} placeholder="0-100" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Preview:</span> {humanReadable}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : isEditing ? (category === "corporate_work" ? "Update Work" : "Update Meeting") : (category === "corporate_work" ? "Schedule Work" : "Schedule Meeting")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringMeetingForm;
