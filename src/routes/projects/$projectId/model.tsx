import { createFileRoute } from '@tanstack/react-router'
import { ProjectDetailsPage } from '@/react-components/ProjectDetailsPage'

// ─── /projects/$projectId/model ───────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/model')({
  component: ProjectDetailsPage,
})

