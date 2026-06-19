import { createFileRoute } from '@tanstack/react-router'
import { DocumentStatusPage } from '@/react-components/DocumentStatusPage'

// ─── /projects/$projectId/documents ───────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/documents')({
  component: DocumentStatusPage,
})

