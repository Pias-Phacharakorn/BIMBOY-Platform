import { createFileRoute } from '@tanstack/react-router'
import { DrawingView } from '@/react-components/views'

// ─── /projects/$projectId/drawing ───────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/drawing')({
  component: DrawingView,
})
