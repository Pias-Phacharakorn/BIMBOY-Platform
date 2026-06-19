import { createFileRoute } from '@tanstack/react-router'
import { ClashDetectionPage } from '@/react-components/ClashDetectionPage'

// ─── /projects/$projectId/clashes ─────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: ClashDetectionPage,
})

