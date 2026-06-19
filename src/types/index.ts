// ─── Centralized Type Exports ─────────────────────────────────────────────────
// Import all domain types from this barrel file

// Project types
export type {
  Project,
  ProjectFormData,
  ProjectStatus,
  ProjectPhase,
  ProjectMember,
  GisCoordinates,
} from './project'
export {
  ProjectSchema,
  ProjectFormSchema,
  ProjectStatusSchema,
  ProjectPhaseSchema,
  ProjectMemberSchema,
  GisCoordinatesSchema,
} from './project'

// Clash types
export type {
  ClashReport,
  ClashItem,
  ClashSeverity,
  ClashStatus,
  ClashDiscipline,
} from './clash'
export {
  ClashReportSchema,
  ClashItemSchema,
  ClashSeveritySchema,
  ClashStatusSchema,
  ClashDisciplineSchema,
} from './clash'

// Document types
export type {
  BimDocument,
  DocumentRevision,
  DocumentFilter,
  DocumentStatus,
  DocumentDiscipline,
  DocumentType,
} from './document'
export {
  BimDocumentSchema,
  DocumentRevisionSchema,
  DocumentFilterSchema,
  DocumentStatusSchema,
  DocumentDisciplineSchema,
  DocumentTypeSchema,
} from './document'
