import { createFileRoute } from '@tanstack/react-router'
import { ModelsView } from '@/react-components/views'

// ─── /projects/$projectId/model ───────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/model')({
  component: ModelsView,
})

