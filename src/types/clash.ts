import { z } from 'zod'

// ─── Clash Severity ───────────────────────────────────────────────────────────
export const ClashSeveritySchema = z.enum(['critical', 'major', 'minor', 'info'])
export type ClashSeverity = z.infer<typeof ClashSeveritySchema>

// ─── Clash Status ─────────────────────────────────────────────────────────────
export const ClashStatusSchema = z.enum([
  'new',
  'active',
  'resolved',
  'accepted',
  'wont-fix',
])
export type ClashStatus = z.infer<typeof ClashStatusSchema>

// ─── Clash Discipline ─────────────────────────────────────────────────────────
export const ClashDisciplineSchema = z.enum([
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'plumbing',
  'civil',
  'other',
])
export type ClashDiscipline = z.infer<typeof ClashDisciplineSchema>

// ─── Individual Clash Item ────────────────────────────────────────────────────
export const ClashItemSchema = z.object({
  id: z.string(),
  /** Display name from the clash report */
  name: z.string(),
  severity: ClashSeveritySchema,
  status: ClashStatusSchema,
  /** Discipline A in the clash pair (e.g., 'structural') */
  disciplineA: ClashDisciplineSchema,
  /** Discipline B in the clash pair (e.g., 'mechanical') */
  disciplineB: ClashDisciplineSchema,
  /** IFC GUIDs of the two clashing elements */
  elementA: z.string().optional(),
  elementB: z.string().optional(),
  /** 3D location of the clash point [x, y, z] */
  location: z.tuple([z.number(), z.number(), z.number()]).optional(),
  /** Free text description or comment */
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  createdAt: z.any(), // Firestore Timestamp
  resolvedAt: z.any().optional(), // Firestore Timestamp
})
export type ClashItem = z.infer<typeof ClashItemSchema>

// ─── Clash Report (Firestore Document) ───────────────────────────────────────
export const ClashReportSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1),
  /** Source file format: bcf (BIM Collaboration Format) or navisworks XML */
  sourceFormat: z.enum(['bcf', 'navisworks', 'manual']),
  totalCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  majorCount: z.number().int().nonnegative(),
  minorCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  clashes: z.array(ClashItemSchema).default([]),
  createdAt: z.any(), // Firestore Timestamp
  updatedAt: z.any(), // Firestore Timestamp
  importedBy: z.string(),
})
export type ClashReport = z.infer<typeof ClashReportSchema>
