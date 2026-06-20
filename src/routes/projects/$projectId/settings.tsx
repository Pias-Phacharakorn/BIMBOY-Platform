import { createFileRoute } from '@tanstack/react-router'
import { SettingsView } from '@/react-components/views/settings'

// ─── /projects/$projectId/settings ────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/settings')({
  component: SettingsView,
})

