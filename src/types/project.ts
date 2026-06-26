import { z } from 'zod'

// ─── Project Status ───────────────────────────────────────────────────────────
export const ProjectStatusSchema = z.enum([
  'active',
  'on-hold',
  'completed',
  'archived',
])
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>

// ─── Project Phase ────────────────────────────────────────────────────────────
export const ProjectPhaseSchema = z.enum([
  'schematic-design',
  'design-development',
  'construction-documents',
  'bidding',
  'construction',
  'close-out',
])
export type ProjectPhase = z.infer<typeof ProjectPhaseSchema>

// ─── GIS Coordinates ─────────────────────────────────────────────────────────
export const GisCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  /** True North rotation in degrees */
  trueNorth: z.number().min(0).max(360).optional(),
})
export type GisCoordinates = z.infer<typeof GisCoordinatesSchema>

// ─── Project Member ───────────────────────────────────────────────────────────
export const ProjectMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'coordinator', 'viewer']),
  avatarUrl: z.string().url().optional(),
  joinedAt: z.any(), // Firestore Timestamp
})
export type ProjectMember = z.infer<typeof ProjectMemberSchema>

// ─── Project (Firestore Document) ────────────────────────────────────────────
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  client: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  status: ProjectStatusSchema,
  phase: ProjectPhaseSchema,
  /** ISO date string — project start date */
  startDate: z.string().optional(),
  /** ISO date string — project target completion */
  endDate: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  gisCoordinates: GisCoordinatesSchema.optional(),
  members: z.array(ProjectMemberSchema).default([]),
  /** Firebase Storage path to the IFC/Fragment model file */
  modelPath: z.string().optional(),
  /** Firestore collection path for sub-documents */
  createdAt: z.any(), // Firestore Timestamp
  updatedAt: z.any(), // Firestore Timestamp
  createdBy: z.string(),
})
export type Project = z.infer<typeof ProjectSchema>

// ─── Project Form Data (for create/edit) ─────────────────────────────────────
export const ProjectFormSchema = ProjectSchema.pick({
  name: true,
  description: true,
  client: true,
  location: true,
  status: true,
  phase: true,
  startDate: true,
  endDate: true,
}).extend({
  gisCoordinates: GisCoordinatesSchema.optional(),
})
export type ProjectFormData = z.infer<typeof ProjectFormSchema>

// ─── UI Type Definitions (Migrated from static-data.ts) ──────────────────────
import type { Project as ClassProject } from "@/classes/Project";

export type ProjectView = "card" | "list";
export type StandardTabId = "bep" | "naming" | "cde";
export type BadgeTone = "ok" | "warn" | "danger" | "neutral";

export interface ProjectDisplay {
  code: string;
  label: string;
  estimatedCompletion: string;
  startDateLabel: string;
  finishDateLabel: string;
  statusLabel: string;
  statusTone: Extract<BadgeTone, "ok" | "warn" | "neutral">;
  progress: number;
  image: string;
}

export interface AppProject extends ClassProject {
  display: ProjectDisplay;
}

export interface StatItem {
  label: string;
  value: string;
  tone?: BadgeTone;
}

export interface ModelFile {
  name: string;
  loaded: boolean;
}

export interface ClashRecord {
  id: string;
  status: string;
  statusTone: Extract<BadgeTone, "ok" | "warn">;
  severity: string;
  severityTone: BadgeTone;
  disciplines: string;
  assignedTo: string;
  dateFound: string;
}

export interface DocumentRecord {
  drawingNumber: string;
  title: string;
  revision: string;
  status: "Approved" | "Pending" | "In Review";
  owner: string;
  dueDate: string;
  overdue?: boolean;
}

export interface ProjectMemberUI {
  email: string;
  role: "Admin" | "Member";
  status: "Active";
}

export interface StandardCard {
  kicker: string;
  title: string;
  body: string;
}

export interface RuleItem {
  code: string;
  title: string;
  note: string;
  status: string;
  tone: Extract<BadgeTone, "ok" | "warn">;
}

export interface NamingRule {
  field: string;
  example: string;
  rule: string;
  status: string;
  tone: Extract<BadgeTone, "ok" | "warn">;
}

export interface CdeTask {
  category: string;
  detail: string;
  responseBy: string;
  status: string;
  tone: Extract<BadgeTone, "ok" | "warn">;
}

