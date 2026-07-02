import { z } from 'zod'

// ─── Clash Type (severity) ───────────────────────────────────────────────────
// Mirrors Navisworks add-in export values (Major/Minor/Regulation) and the
// `clash_type` Postgres enum.
export const ClashTypeSchema = z.enum(['major', 'minor', 'regulation'])
export type ClashType = z.infer<typeof ClashTypeSchema>

// ─── Clash Status ─────────────────────────────────────────────────────────────
// Mirrors Navisworks add-in export values and the `clash_status` Postgres enum.
export const ClashStatusSchema = z.enum([
  'new',
  'unresolved',
  'resolved',
  'approved_as_note',
])
export type ClashStatus = z.infer<typeof ClashStatusSchema>

// ─── Clash Source Format ─────────────────────────────────────────────────────
export const ClashSourceFormatSchema = z.enum(['navisworks', 'bcf', 'manual'])
export type ClashSourceFormat = z.infer<typeof ClashSourceFormatSchema>

// ─── Camera (Navisworks viewpoint snapshot) ──────────────────────────────────
export const ClashCameraSchema = z.object({
  projection: z.enum(['Perspective', 'Orthographic']),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  target: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  up: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  fov: z.number(),
  viewHeight: z.number(),
  viewWidth: z.number(),
})
export type ClashCamera = z.infer<typeof ClashCameraSchema>

// ─── Individual Clash Viewpoint (clash_viewpoints row) ───────────────────────
export const ClashItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  reportId: z.string().nullable().optional(),
  /** Navisworks SavedViewpoint GUID */
  guid: z.string(),
  name: z.string(),
  /** Folder hierarchy path in the Navisworks viewpoint tree */
  path: z.string().nullable().optional(),
  type: ClashTypeSchema,
  status: ClashStatusSchema,
  markup: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  planImageUrl: z.string().nullable().optional(),
  sectionImageUrl: z.string().nullable().optional(),
  camera: ClashCameraSchema.nullable().optional(),
  /** Navisworks GUIDs of the model elements selected for this viewpoint */
  selection: z.array(z.string()).nullable().optional(),
  occurredAt: z.string(),
  createdBy: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ClashItem = z.infer<typeof ClashItemSchema>

// ─── Clash Report (clash_reports row = one "push to cloud" import batch) ────
export const ClashReportSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1),
  sourceFormat: ClashSourceFormatSchema,
  totalCount: z.number().int().nonnegative(),
  majorCount: z.number().int().nonnegative(),
  minorCount: z.number().int().nonnegative(),
  regulationCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  importedBy: z.string().nullable().optional(),
  importedAt: z.string(),
})
export type ClashReport = z.infer<typeof ClashReportSchema>
