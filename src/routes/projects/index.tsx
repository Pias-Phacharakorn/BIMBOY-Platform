import { createFileRoute } from '@tanstack/react-router'
import { ProjectsView } from '@/react-components/views'

// ─── /projects (index) ────────────────────────────────────────────────────────
export const Route = createFileRoute('/projects/')({
  component: ProjectsView,
})

