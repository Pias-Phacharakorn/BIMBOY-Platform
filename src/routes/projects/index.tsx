import { createFileRoute } from '@tanstack/react-router'
import { ProjectsPage } from '@/react-components/ProjectsPage'

// ─── /projects (index) ────────────────────────────────────────────────────────
export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
})

