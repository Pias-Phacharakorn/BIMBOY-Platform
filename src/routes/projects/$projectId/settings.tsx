import { createFileRoute } from '@tanstack/react-router'
import { ProjectSettingsPage } from '@/react-components/ProjectSettingsPage'

// ─── /projects/$projectId/settings ────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/settings')({
  component: ProjectSettingsPage,
})

