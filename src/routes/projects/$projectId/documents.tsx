import { createFileRoute } from '@tanstack/react-router'
import { DocumentsView } from '@/react-components/views/documents'

// ─── /projects/$projectId/documents ───────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/documents')({
  component: DocumentsView,
})

