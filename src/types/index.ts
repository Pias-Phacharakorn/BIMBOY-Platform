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
  ProjectView,
  StandardTabId,
  BadgeTone,
  ProjectDisplay,
  AppProject,
  StatItem,
  ModelFile,
  ClashRecord,
  DocumentRecord,
  ProjectMemberUI,
  StandardCard,
  RuleItem,
  NamingRule,
  CdeTask,
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
  ClashType,
  ClashStatus,
  ClashSourceFormat,
  ClashCamera,
} from './clash'
export {
  ClashReportSchema,
  ClashItemSchema,
  ClashTypeSchema,
  ClashStatusSchema,
  ClashSourceFormatSchema,
  ClashCameraSchema,
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
