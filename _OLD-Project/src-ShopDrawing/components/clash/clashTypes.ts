export type ClashStatus = "Open" | "In Progress" | "Closed";
export type ClashPriority = "Low" | "Medium" | "High" | "Critical";

export interface Clash {
  id: string;
  project_id: string;
  issue_number: number | null;
  vp_key: string | null;
  name: string;
  issue_type: string | null;
  status: ClashStatus;
  priority: ClashPriority;
  discipline: string | null;
  level: string | null;
  zone: string | null;
  phase: string | null;
  originator: string | null;
  assigned_to: string | null;
  author_email: string | null;
  element_id: string | null;
  due_date: string | null;
  description: string | null;
  thumbnail_url: string | null;
  plan_view_url: string | null;
  section_view_url: string | null;
  solution: string | null;
  markup: string | null;
  folder: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClashComment {
  id: string;
  viewpoint_id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ClashHistoryEntry {
  id: string;
  viewpoint_id: string;
  project_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  details: any;
  created_at: string;
}

export const STATUS_OPTIONS: ClashStatus[] = ["Open", "In Progress", "Closed"];
export const PRIORITY_OPTIONS: ClashPriority[] = ["Low", "Medium", "High", "Critical"];
export const DISCIPLINES = ["ARC", "ELE", "FPS", "PNS", "STL", "STR", "VAC"];

export const STATUS_COLORS: Record<ClashStatus, string> = {
  Open: "#1D4ED8",          // blue (like BIM Track Open pill)
  "In Progress": "#047857", // green (old Closed color)
  Closed: "#6B7280",        // medium grey
};

export const PRIORITY_COLORS: Record<ClashPriority, string> = {
  Low: "#6B7280",
  Medium: "#0EA5E9",
  High: "#F59E0B",
  Critical: "#DC2626",
};

export const DISC_COLORS: Record<string, string> = {
  ARC: "#1B3D6F",
  ELE: "#F59E0B",
  FPS: "#DC2626",
  PNS: "#0EA5E9",
  STL: "#6B7280",
  STR: "#7C3AED",
  VAC: "#10B981",
};

export const isOverdue = (c: Clash): boolean => {
  if (!c.due_date || c.status === "Closed") return false;
  return new Date(c.due_date) < new Date(new Date().toDateString());
};

export const issueLabel = (c: Clash) =>
  c.issue_number != null ? `#${c.issue_number}` : c.vp_key ? `#${c.vp_key}` : "—";
