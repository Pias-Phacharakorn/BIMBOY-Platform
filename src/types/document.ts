import { z } from 'zod'

// ─── Document Status ──────────────────────────────────────────────────────────
export const DocumentStatusSchema = z.enum([
  'draft',
  'under-review',
  'approved',
  'approved-with-comments',
  'rejected',
  'superseded',
  'void',
])
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>

// ─── Document Discipline ──────────────────────────────────────────────────────
export const DocumentDisciplineSchema = z.enum([
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'plumbing',
  'civil',
  'general',
  'specification',
  'report',
])
export type DocumentDiscipline = z.infer<typeof DocumentDisciplineSchema>

// ─── Document Type ────────────────────────────────────────────────────────────
export const DocumentTypeSchema = z.enum([
  'drawing',
  'shop-drawing',
  'specification',
  'report',
  'rfi',
  'submittal',
  'transmittal',
  'meeting-minutes',
  'photo',
  'model',
  'other',
])
export type DocumentType = z.infer<typeof DocumentTypeSchema>

// ─── Document Revision ────────────────────────────────────────────────────────
export const DocumentRevisionSchema = z.object({
  revision: z.string(),
  status: DocumentStatusSchema,
  storagePath: z.string(),
  fileSize: z.number().nonnegative(),
  mimeType: z.string(),
  uploadedBy: z.string(),
  uploadedAt: z.any(), // Firestore Timestamp
  comments: z.string().optional(),
})
export type DocumentRevision = z.infer<typeof DocumentRevisionSchema>

// ─── BIM Document (Firestore Document) ───────────────────────────────────────
export const BimDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Human-readable document number (e.g., "A-DR-001") */
  documentNumber: z.string().min(1),
  title: z.string().min(1).max(200),
  type: DocumentTypeSchema,
  discipline: DocumentDisciplineSchema,
  status: DocumentStatusSchema,
  /** Current active revision label (e.g., "Rev C") */
  currentRevision: z.string(),
  /** Ordered list of revisions, newest first */
  revisions: z.array(DocumentRevisionSchema).default([]),
  /** Assigned reviewer user ID */
  reviewedBy: z.string().optional(),
  /** ISO date string — document due date */
  dueDate: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.any(), // Firestore Timestamp
  updatedAt: z.any(), // Firestore Timestamp
  createdBy: z.string(),
})
export type BimDocument = z.infer<typeof BimDocumentSchema>

// ─── Document Filter (for UI state) ──────────────────────────────────────────
export const DocumentFilterSchema = z.object({
  search: z.string().default(''),
  status: DocumentStatusSchema.optional(),
  discipline: DocumentDisciplineSchema.optional(),
  type: DocumentTypeSchema.optional(),
})
export type DocumentFilter = z.infer<typeof DocumentFilterSchema>
