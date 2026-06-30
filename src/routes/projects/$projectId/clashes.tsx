import { createFileRoute } from '@tanstack/react-router'
import { ClashView } from '@/react-components/views'

// ─── /projects/$projectId/clashes ─────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: ClashView,
})

